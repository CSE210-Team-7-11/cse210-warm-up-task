import './PrecisionWarnings.css'

export default function PrecisionWarnings({ warnings }) {
  if (!warnings.length) return null
  return (
    <div className="precision-warnings" role="status">
      <p>{warnings.length} {warnings.length === 1 ? 'value was' : 'values were'} rounded. The chart uses the stored values.</p>
      <ul>
        {warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
      </ul>
    </div>
  )
}
