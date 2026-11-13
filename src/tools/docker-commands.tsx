import { CommandBuilder } from '@/components/kit'
import { DOCKER } from '@/lib/commands'

export default function DockerCommands() {
  return <CommandBuilder recipes={DOCKER} />
}
