import { CommandBuilder } from '@/components/kit'
import { GIT } from '@/lib/commands'

export default function GitCommands() {
  return <CommandBuilder recipes={GIT} searchable notice="Commands marked with ⚠ can lose work. Each one explains the risk below the form." />
}
