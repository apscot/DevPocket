import { TransformTool } from '@/components/kit'
import { asciiTree } from '@/lib/text'

const SAMPLE = `src/main/java/com/example/App.java
src/main/java/com/example/web/UserController.java
src/main/resources/application.yml
src/test/java/com/example/AppTests.java
pom.xml
README.md
node_modules/left-pad/index.js
.git/HEAD`
export default function AsciiTree() {
  return <TransformTool sample={SAMPLE} filename="tree.txt"
    notice={{ kind: 'info', text: 'Paste a list of paths (e.g. from `find`, `git ls-files`) or an indented outline. Directories are inferred from path segments.' }}
    options={[
      { key: 'root', label: 'Root label', type: 'text', default: 'my-project' }, { key: 'style', label: 'Branches', type: 'select', default: 'unicode', options: [['unicode', '├── Unicode'], ['ascii', '|-- ASCII']] },
      { key: 'exclude', label: 'Exclude (comma, * wildcards)', type: 'text', default: 'node_modules,.git' }, { key: 'maxDepth', label: 'Max depth', type: 'number', default: 10, min: 1 },
      { key: 'dirsFirst', label: 'Directories first', type: 'check', default: true }, { key: 'sort', label: 'Sort alphabetically', type: 'check', default: true }, { key: 'slash', label: 'Trailing / on directories', type: 'check', default: true },
    ]}
    run={(i, o) => asciiTree(i, o as never)} />
}
