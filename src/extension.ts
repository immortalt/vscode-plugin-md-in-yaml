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
      if (currentPanel) {
        // If a panel is already open, reveal it and update the content
        currentPanel.reveal();
        updateWebviewContent(document, currentPanel, fileName, md);
      } else {
        // Otherwise, create a new preview panel
        currentPanel = vscode.window.createWebviewPanel(
          "yamlPreview",
          "YAML Preview",
          vscode.ViewColumn.Beside,
          {
            retainContextWhenHidden: true,
          }
        );
        updateWebviewContent(document, currentPanel, fileName, md);

        // Dispose of the panel when it is closed
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
  const body = `<ul>${renderObject(content, md)}</ul>`;
  return `<html><head>${style}</head><body>${body}</body></html>`;
}

function renderObject(
  obj: any,
  md: MarkdownIt,
  isRoot: boolean = true
): string {
  let htmlContent = "";
  if (Array.isArray(obj)) {
    htmlContent += `<ul>${obj
      .map((item) => `<li>${renderObject(item, md, false)}</li>`)
      .join("")}</ul>`;
  } else if (typeof obj === "object" && obj !== null) {
    let innerContent = Object.entries(obj)
      .filter(([key]) => !(isRoot && key === "Title"))
      .map(([key, value]) => {
        const valueHtml =
          typeof value === "string"
            ? md.render(value)
            : renderObject(value, md, false);
        return `<li>${key} ${valueHtml}</li>`;
      })
      .join("");
    htmlContent = isRoot ? innerContent : `<ul>${innerContent}</ul>`;
  } else if (typeof obj === "string") {
    htmlContent += md.render(obj);
  } else {
    htmlContent += obj.toString();
  }
  if (isRoot && obj && typeof obj["Title"] === "string") {
    htmlContent = `<h1>${md.render(obj["Title"])}</h1>` + htmlContent;
  }
  return htmlContent;
}

// This method is called when your extension is deactivated
export function deactivate() {}
