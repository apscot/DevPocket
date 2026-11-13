import { TransformTool } from '@/components/kit'
import { csvToSql } from '@/lib/csv'
import { SAMPLE_CSV } from '@/lib/samples'

export default function CsvToSql() {
  return (
    <TransformTool
      sample={SAMPLE_CSV} filename="inserts.sql" mime="application/sql" accept=".csv,.tsv,.txt"
      options={[
        { key: 'table', label: 'Table name', type: 'text', default: 'users' },
        { key: 'columns', label: 'Column names (comma-separated, optional)', type: 'text', default: '', hint: 'Overrides header names' },
        { key: 'delimiter', label: 'Delimiter', type: 'select', default: 'auto', options: [['auto', 'Auto'], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']] },
        { key: 'quote', label: 'Identifier quoting', type: 'select', default: 'none', options: [['none', 'None'], ['ansi', '"ANSI"'], ['backtick', '`MySQL`'], ['bracket', '[SQL Server]']] },
        { key: 'header', label: 'First row is header', type: 'check', default: true },
        { key: 'nullEmpty', label: 'Empty → NULL', type: 'check', default: true },
        { key: 'infer', label: 'Detect numbers/booleans', type: 'check', default: true },
        { key: 'batch', label: 'Single multi-row INSERT', type: 'check', default: true },
        { key: 'createTable', label: 'Include CREATE TABLE', type: 'check', default: false },
      ]}
      run={(i, o) => csvToSql(i, { ...o, columns: String(o.columns).split(',').map((c) => c.trim()).filter(Boolean) })}
    />
  )
}
