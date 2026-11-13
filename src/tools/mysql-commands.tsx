import { CommandBuilder } from '@/components/kit'
import { MYSQL } from '@/lib/commands'

export default function MySqlCommands() {
  return <CommandBuilder recipes={MYSQL} searchable notice="SQL statements use backtick-quoted identifiers. Values shown are placeholders — never run generated destructive statements without a backup." />
}
