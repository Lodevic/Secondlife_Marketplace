import { buildCsv, escapeHtml } from '../src/utils/exportUtils.js'

let passed = 0
let failed = 0

function check(name, condition) {
  if (condition) {
    passed += 1
    console.log(`[OK] ${name}`)
  } else {
    failed += 1
    console.error(`[GAGAL] ${name}`)
  }
}

const columns = [{ header: 'nilai', accessor: 'value' }]

check(
  'CSV mengutip koma, tanda kutip, dan newline',
  buildCsv(columns, [{ value: 'a,b "c"\nd' }]) ===
    '\uFEFFnilai\r\n"a,b ""c""\nd"',
)
check(
  'CSV mencegah formula injection untuk =, +, -, @',
  buildCsv(columns, ['=1+1', '+cmd', '-1+2', '@SUM(A1)'].map((value) => ({ value }))) ===
    "\uFEFFnilai\r\n'=1+1\r\n'+cmd\r\n'-1+2\r\n'@SUM(A1)",
)
check(
  'escapeHtml mengamankan tag script dan tanda kutip',
  escapeHtml(`<script title="x">'&</script>`) ===
    '&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;',
)
check(
  'CSV mengubah null, undefined, dan string kosong menjadi tanda hubung',
  buildCsv(
    [
      { header: 'null', accessor: 'nullValue' },
      { header: 'undefined', accessor: 'missing' },
      { header: 'empty', accessor: 'empty' },
    ],
    [{ nullValue: null, empty: '' }],
  ) === '\uFEFFnull,undefined,empty\r\n-,-,-',
)
check(
  'CSV dimulai dengan BOM UTF-8',
  buildCsv(columns, [{ value: 'data' }]).charCodeAt(0) === 0xfeff,
)
check('escapeHtml menampilkan nilai null sebagai tanda hubung', escapeHtml(null) === '-')

console.log(`\nHasil: ${passed} lolos, ${failed} gagal`)
if (failed > 0) process.exitCode = 1
