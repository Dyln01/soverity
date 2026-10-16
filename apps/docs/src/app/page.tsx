import { readFile } from "node:fs/promises"
import path from "node:path"

/** Renders the SDK guide (GUIDE.md) as the docs homepage. */
async function getGuide(): Promise<string> {
  try {
    return await readFile(path.join(process.cwd(), "GUIDE.md"), "utf8")
  } catch {
    return "# Soverity SDK\n\nGuide unavailable."
  }
}

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n")
  const nodes: React.ReactNode[] = []
  let inCode = false
  let codeLines: string[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        nodes.push(
          <pre
            key={key++}
            className="mb-4 overflow-x-auto rounded-xl p-4 font-mono text-sm"
            style={{
              background: "rgba(10,12,22,0.6)",
              border: "1px solid var(--sv-border-soft)",
              color: "var(--sv-teal)",
            }}
          >
            <code>{codeLines.join("\n")}</code>
          </pre>,
        )
        codeLines = []
      }
      inCode = !inCode
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={key++} className="mb-4 text-3xl font-bold">
          {line.slice(2)}
        </h1>,
      )
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={key++} className="mb-3 mt-10 text-2xl font-semibold">
          {line.slice(3)}
        </h2>,
      )
    } else if (line.trim() && !line.startsWith("|")) {
      nodes.push(
        <p key={key++} className="mb-3" style={{ color: "var(--sv-text-secondary)" }}>
          {line}
        </p>,
      )
    }
  }
  return nodes
}

export default async function DocsPage() {
  const guide = await getGuide()
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-6 text-xs uppercase tracking-widest" style={{ color: "var(--sv-teal)" }}>
        Soverity Docs
      </p>
      {renderMarkdown(guide)}
    </div>
  )
}
