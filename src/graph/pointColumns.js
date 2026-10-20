export function columnsFromPoints(series) {
  const hoverPoints = []
  series.forEach((oneSeries, seriesNumber) => {
    oneSeries.points.forEach((point, pointNumber) => {
      if (Number.isFinite(point.x)) hoverPoints.push({ point, seriesNumber, pointNumber })
    })
  })
  hoverPoints.sort((a, b) => a.point.x - b.point.x)

  const length = hoverPoints.length
  const x = new Float64Array(length)
  const ys = series.map(() => new Float64Array(length).fill(-Infinity))
  hoverPoints.forEach(({ point, seriesNumber }, i) => {
    x[i] = point.x
    ys[seriesNumber][i] = point.y
  })
  return { columns: { length, x, ys }, hoverPoints }
}
