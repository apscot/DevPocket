import { format, type SqlLanguage } from 'sql-formatter'
import { TransformTool } from '@/components/kit'
import { minifySql } from '@/lib/sql'

const LANGS: [string, string][] = [['sql', 'Standard SQL'], ['mysql', 'MySQL'], ['mariadb', 'MariaDB'], ['postgresql', 'PostgreSQL'], ['sqlite', 'SQLite'], ['transactsql', 'SQL Server (T-SQL)'], ['plsql', 'Oracle PL/SQL'], ['db2', 'DB2'], ['bigquery', 'BigQuery'], ['redshift', 'Redshift'], ['spark', 'Spark'], ['trino', 'Trino']]
const SAMPLE = "select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=true and u.created_at>'2024-01-01' group by u.id,u.name having count(o.id)>2 order by orders desc limit 10;"
export default function SqlFormatter() {
  return <TransformTool sample={SAMPLE} filename="query.sql" mime="application/sql" accept=".sql,.txt"
    options={[
      { key: 'mode', label: 'Mode', type: 'select', default: 'format', options: [['format', 'Format'], ['minify', 'Minify']] },
      { key: 'lang', label: 'Dialect', type: 'select', default: 'sql', options: LANGS, show: (o) => o.mode === 'format' },
      { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']], show: (o) => o.mode === 'format' },
      { key: 'kw', label: 'Keywords', type: 'select', default: 'upper', options: [['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['preserve', 'Preserve']], show: (o) => o.mode === 'format' },
      { key: 'between', label: 'Blank lines between queries', type: 'number', default: 1, min: 0, max: 5, show: (o) => o.mode === 'format' },
    ]}
    run={(i, o) => o.mode === 'minify' ? minifySql(i) : format(i, { language: o.lang as SqlLanguage, tabWidth: o.indent === 'tab' ? 2 : Number(o.indent), useTabs: o.indent === 'tab', keywordCase: o.kw as 'upper', linesBetweenQueries: Number(o.between) })} />
}
