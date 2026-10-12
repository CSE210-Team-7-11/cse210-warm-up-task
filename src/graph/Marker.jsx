// circle, square or triangle so series dont rely on color alone
export default function Marker({ shape, cx, cy, r, color }) {
  const style = { fill: color }

  if (shape === 'square') {
    return <rect className="point" style={style} x={cx - r} y={cy - r} width={2 * r} height={2 * r} />
  }

  if (shape === 'triangle') {
    const corners = `${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`
    return <polygon className="point" style={style} points={corners} />
  }

  return <circle className="point" style={style} cx={cx} cy={cy} r={r} />
}
