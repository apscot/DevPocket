import { CommandBuilder } from '@/components/kit'
import { POSTGRES } from '@/lib/commands'

export default function PostgresCommands() {
  return <CommandBuilder recipes={POSTGRES} searchable notice="SQL uses double-quoted identifiers. Review destructive statements and keep backups before running them." />
}
