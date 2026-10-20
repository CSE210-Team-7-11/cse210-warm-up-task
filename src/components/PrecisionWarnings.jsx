import './PrecisionWarnings.css'

export default function PrecisionWarnings({ warnings, count = warnings.length }) {
  if (!warnings.length) return null
  return (
    <div className="precision-warnings" role="status">
      <p>{count} {count === 1 ? 'value was' : 'values were'} rounded.</p>
      <ul>
        {warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
      </ul>
      {count > warnings.length && <p>List truncated. Showing the first {warnings.length} of {count} warnings.</p>}
    </div>
  )
}
