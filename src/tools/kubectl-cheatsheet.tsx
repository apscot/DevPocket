import { CommandBuilder } from '@/components/kit'
import { K8S } from '@/lib/commands'

export default function Kubectl() {
  return <CommandBuilder recipes={K8S} searchable notice="Search or filter by category, tweak the options and copy the kubectl command. Commands marked ⚠ are destructive." />
}
