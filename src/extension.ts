// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as yaml from "js-yaml";
import MarkdownIt from "markdown-it";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const md = new MarkdownIt();
  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  // Function to open the preview window
  function openPreviewWindow() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;
      const fileName = path.basename(document.fileName);

      // Calculate the current scroll percentage
      const firstVisibleLine = editor.visibleRanges[0].start.line;
      const totalLines = document.lineCount;
      const scrollPercentage = firstVisibleLine / totalLines;

      if (currentPanel) {
        currentPanel.reveal();
        updateWebviewContent(document, currentPanel, fileName, md);
        // Send the current scroll position to the preview window
        currentPanel.webview.postMessage({
          type: "scroll",
          percentage: scrollPercentage,
        });
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "yamlPreview",
          "YAML Preview",
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        updateWebviewContent(document, currentPanel, fileName, md);
        // Send the current scroll position to the preview window
        currentPanel.webview.postMessage({
          type: "scroll",
          percentage: scrollPercentage,
        });

        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
      }
    }
  }

  // Register the command to open the preview window
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-plugin-yaml-preview.previewYaml",
      openPreviewWindow
    )
  );

  // Automatically open the preview window when a YAML file is opened
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      if (editor.document.languageId === "yaml") {
        openPreviewWindow();
      }
    }
  });

  // Register the event listener for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (
        currentPanel &&
        e.document === vscode.window.activeTextEditor?.document
      ) {
        const fileName = path.basename(e.document.fileName);
        updateWebviewContent(e.document, currentPanel, fileName, md);
      }
    })
  );

  // Add a listener in the activate function to monitor changes in the visible range of the editor
  vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    if (event.textEditor === vscode.window.activeTextEditor) {
      // Calculate the scroll percentage based on the first visible line in the editor
      const firstVisibleLine = event.visibleRanges[0].start.line;
      const totalLines = event.textEditor.document.lineCount;
      const scrollPercentage = firstVisibleLine / totalLines;

      // Send the scroll position message if the preview panel is open
      if (currentPanel) {
        currentPanel.webview.postMessage({
          type: "scroll",
          percentage: scrollPercentage,
        });
      }
    }
  });
}

function updateWebviewContent(
  document: vscode.TextDocument,
  panel: vscode.WebviewPanel,
  fileName: string,
  md: MarkdownIt
) {
  if (document.languageId === "yaml") {
    try {
      const content = document.getText();
      const parsedContent = yaml.load(content);
      panel.webview.html = getWebviewContent(parsedContent, md);
      panel.title = `Preview ${fileName}`;
    } catch (e: any) {
      panel.webview.html = `<html><body><p>Error parsing YAML: ${e.message}</p></body></html>`;
    }
  }
}

function getWebviewContent(content: any, md: MarkdownIt): string {
  const style = `
  <style>
      body { font-family: Arial, sans-serif; line-height: 1.2; }
      dl { margin: 2px 0; }
      dt { font-weight: bold; }
      dd { margin: 1px 0 2px 16px; }
      ul, ol { margin: 2px 0 2px 8px; padding-left: 20px; }
      li { margin: 0.5px 0; }
      p { margin: 0; margin-top: 4px; }
      h1, h2, h3, h4, h5 { margin: 0; margin-top: 4px; margin-bottom: 4px; }
  </style>
  `;
  const script = `<script>
  // Listen for messages sent from the VS Code extension
  window.addEventListener('message', event => {
    console.log(event);
    const message = event.data;
    // Adjust the scroll position of the preview page based on the received scroll percentage
    if (message.type === 'scroll') {
      window.scrollTo(0, document.body.scrollHeight * message.percentage);
    }
  });
</script>`;
  const body = `<ul>${renderObject(content, md)}</ul>`;
  console.log(body);
  return `<html><head>${script}${style}</head><body>${body}</body></html>`;
}

function renderObject(
  obj: any,
  md: MarkdownIt,
  isRoot: boolean = true
): string {
  let htmlContent = "";
  if (Array.isArray(obj)) {
    htmlContent += `<ul>${obj
      .map((item) => {
        if (typeof item === "object" && !Array.isArray(item)) {
          // Handle object type array elements
          return Object.entries(item)
            .map(([key, value]) => {
              const valueHtml = renderObject(value, md, false);
              // If the value is an array, do not nest <ul>, directly use valueHtml
              if (Array.isArray(value)) {
                return `<li>${key}: ${valueHtml}</li>`;
              } else {
                return `<li>${key}:<ul>${valueHtml}</ul></li>`;
              }
            })
            .join("");
        } else {
          // Handle non-object type array elements
          return `<li>${renderObject(item, md, false)}</li>`;
        }
      })
      .join("")}</ul>`;
  } else if (typeof obj === "object" && obj !== null) {
    // Handle object types
    let innerContent = Object.entries(obj)
      .filter(([key]) => !(isRoot && key === "Title"))
      .map(([key, value]) => {
        const valueHtml = renderObject(value, md, false);
        return `<li>${key}: ${valueHtml}</li>`;
      })
      .join("");
    htmlContent = isRoot ? innerContent : `<ul>${innerContent}</ul>`;
  } else if (typeof obj === "string") {
    // Handle string types
    htmlContent += md.render(obj);
  } else {
    // Handle other types
    htmlContent += obj.toString();
  }
  if (isRoot && obj && typeof obj["Title"] === "string") {
    htmlContent = `<h1>${md.render(obj["Title"])}</h1>` + htmlContent;
  }
  return htmlContent;
}

// This method is called when your extension is deactivated
export function deactivate() {}
