const terminalLanguages = new Set([
  'bash', 'shell', 'sh', 'zsh', 'powershell', 'ps1', 'console', 'shellsession', 'cmd', 'bat', 'batch',
]);

// Astro puts the Markdown fence language on the rendered <pre> element.
export function codeBlockPresentation(language) {
  const label = language?.trim().toLowerCase() || 'text';
  return { kind: terminalLanguages.has(label) ? 'terminal' : 'editor', label };
}
