/**
 * @file Shared chart contracts for documentation and editor type information.
 */

/**
 * Storage for one numeric column.
 * @typedef {(Float32Array|Float64Array)} NumericColumn
 */

/**
 * Aligned observations shared by all series. Index i identifies the same row in
 * x and every Y column, and ys[s] belongs to series[s]. Filtering or sorting must
 * preserve these pairings. The chart retains the supplied arrays, so call update
 * after changing their contents.
 * @typedef {Object} NumericColumns
 * @property {number} length Number of observations to read from each column.
 * @property {NumericColumn} x Finite X values in ascending order, including duplicates.
 * @property {Array<NumericColumn>} ys One Y column per series. Use Infinity when a
 * missing observation should break a line and -Infinity when it should connect to
 * the next finite observation. Bounds, fits, and hover targets use finite Y
 * observations. Resolve NaN to a value or sentinel before supplying chart data.
 */

/**
 * Supported marker geometry. An omitted marker is drawn as a circle.
 * @typedef {('circle'|'square'|'triangle'|'none')} MarkerShape
 */

/**
 * Appearance and name of the Y column at the same series index.
 * @typedef {Object} SeriesStyle
 * @property {string} [name] Label for legends and tooltips. A non-empty name creates a legend entry.
 * @property {string} [color] Canvas color. Missing colors are assigned while the
 * automatic palette has capacity. Only six-digit hex strings constrain that search.
 * @property {MarkerShape} [marker] Point shape. Scatter plots replace 'none' with 'circle'.
 * @property {string} [dash] Space- or comma-separated dash lengths. Use '' for a solid line.
 */

/**
 * Resolved chart text, drawn literally on the canvas.
 * @typedef {Object} ChartLabels
 * @property {string} title Chart title.
 * @property {string} subtitle Text below the title.
 * @property {string} x_axis_label Horizontal axis label.
 * @property {string} y_axis_label Vertical axis label.
 */

/**
 * Complete input for an initial draw or update. Each update replaces the previous
 * configuration, applying defaults to any omitted optional settings.
 * @typedef {Object} ChartOptions
 * @property {NumericColumns} columns Sorted, aligned numeric data.
 * @property {Array<SeriesStyle>} series Styles paired with columns.ys by index.
 * @property {('line'|'scatter')} [type='scatter'] Plot type.
 * @property {Partial<ChartLabels>} [labels] Text overrides. Defaults are 'Your Title',
 * 'Your Subtitle', 'Your X Axis Label', and 'Your Y Axis Label'. Use '' to omit text.
 * @property {string} [xColumnName] X column name in numeric diagnostics, defaulting
 * to the resolved X axis label.
 * @property {boolean} [showTrendLine=false] Draw linear fits on scatter plots.
 * @property {boolean} [showPoints=true] Show markers on line plots. Scatter plots always show them.
 * @property {number} [pointSize=7] Marker size in logical chart units.
 */

/**
 * A two-item array ['legend-overflow', omittedCount] reporting how many legend
 * entries were omitted. Their series remain plotted.
 * @typedef {Array<(string|number)>} LegendWarning
 */

/**
 * Warnings from a completed update. Numeric failures are reported as exceptions.
 * Series with omitted legend entries remain plotted.
 * @typedef {Object} ChartUpdateResult
 * @property {Array<LegendWarning>} warnings Legend omissions, or an empty array.
 */

/**
 * Replace the configuration and redraw an existing chart.
 * @callback ChartUpdate
 * @param {ChartOptions} options Complete chart configuration.
 * @returns {ChartUpdateResult} Warnings from the new legend layout.
 * @throws {module:numericErrors.Float64OverflowError} A numeric calculation is non-finite.
 * @throws {module:numericErrors.NumericOverflowErrors} Independent calculations overflowed.
 */

/**
 * Release a chart's canvas, listeners, observer, and prepared view.
 * @callback ChartDestroy
 * @returns {void}
 */

/**
 * Lifecycle operations returned by createChart.
 * @typedef {Object} ChartHandle
 * @property {ChartUpdate} update Replace all chart settings and redraw. A failed update
 * may leave partial changes to the previous state.
 * @property {ChartDestroy} destroy Remove the chart when it is no longer needed.
 * Discard the handle afterward because resizing and interaction have been disconnected.
 */

/**
 * Convert a data value to a logical drawing coordinate, or the reverse.
 * @callback CoordinateMap
 * @param {number} value Value in the mapping's input coordinate system.
 * @returns {number} Corresponding value in its output coordinate system.
 */

/**
 * Bounds of rows containing at least one finite Y value.
 * @typedef {Object} DataBounds
 * @property {number} xMin Smallest contributing X, or Infinity when empty.
 * @property {number} xMax Largest contributing X, or -Infinity when empty.
 * @property {number} yMin Smallest finite Y, or Infinity when empty.
 * @property {number} yMax Largest finite Y, or -Infinity when empty.
 * @property {number} count Number of finite Y observations across all series.
 */

/**
 * Space reserved between the chart edges and plot in logical chart units.
 * @typedef {Object} ChartMargins
 * @property {number} left Space for the Y axis and tick labels.
 * @property {number} right Space after the right plot edge.
 * @property {number} top Space for header text and the first legend row.
 * @property {number} bottom Space for X ticks and the axis label.
 */

/**
 * Plot rectangle in logical chart coordinates, with Y increasing downward.
 * @typedef {Object} PlotBounds
 * @property {number} left Left edge.
 * @property {number} right Right edge.
 * @property {number} top Top edge.
 * @property {number} bottom Bottom edge.
 */

/**
 * Plot geometry, axis values, and coordinate mappings. The chart uses a fixed logical
 * width of WIDTH and increases its height to accommodate extra legend rows.
 * @typedef {Object} ChartLayout
 * @property {number} xMin Minimum X in the data domain.
 * @property {number} xMax Maximum X in the data domain.
 * @property {number} yMin Minimum Y in the data domain.
 * @property {number} yMax Maximum Y in the data domain.
 * @property {number} left Left plot edge.
 * @property {number} right Right plot edge.
 * @property {number} top Top plot edge, below the header and legend.
 * @property {number} bottom Bottom plot edge.
 * @property {number} height Total logical chart height.
 * @property {CoordinateMap} toX Data X to drawing X.
 * @property {CoordinateMap} toY Map data Y to drawing Y, placing larger values higher.
 * @property {CoordinateMap} fromX Drawing X to data X.
 * @property {CoordinateMap} fromY Drawing Y to data Y.
 * @property {Array<number>} xTicks Horizontal-axis tick values, including endpoints.
 * @property {Array<number>} yTicks Vertical-axis tick values, including endpoints.
 * @property {Array<number>} xGridlines Interior horizontal-axis tick values.
 * @property {Array<number>} yGridlines Interior vertical-axis tick values.
 * @property {LegendLayout} [legend] Measured legend attached by the chart controller.
 */

/**
 * Ordinary least-squares fit y = slope * x + startHeight.
 * @typedef {Object} TrendFit
 * @property {number} slope Fitted change in Y per unit X.
 * @property {number} startHeight Fitted Y intercept at X = 0, possibly outside the sampled X range.
 * @property {number} firstX Smallest X with a finite Y value.
 * @property {number} lastX Largest X with a finite Y value.
 */

/**
 * A fitted line evaluated at the first and last X values with finite Y observations.
 * Its Y endpoints may exceed the observed Y range, so rendering clips to the plot.
 * @typedef {Object} RenderedTrend
 * @property {string} [color] Stroke color, defaulting to DEFAULT_COLOR when omitted.
 * @property {number} firstX First endpoint X.
 * @property {number} firstY First endpoint Y.
 * @property {number} lastX Last endpoint X.
 * @property {number} lastY Last endpoint Y.
 */

/**
 * A positioned legend item in logical chart units.
 * @typedef {Object} LegendEntry
 * @property {string} label Series name.
 * @property {string} [color] Symbol color.
 * @property {MarkerShape} [shape] Symbol shape. A 'none' marker is represented by a short line.
 * @property {number} r Symbol radius.
 * @property {number} width Total measured symbol, padding, and label width.
 * @property {number} x Left edge of the symbol, with its center at x + r.
 * @property {number} y Symbol center Y.
 */

/**
 * Measured legend contents and space reserved above the plot.
 * @typedef {Object} LegendLayout
 * @property {Array<LegendEntry>} entries Visible named series in display order.
 * @property {number} extraHeight Height beyond the first legend row.
 * @property {Array<LegendWarning>} warnings Omitted-entry counts, or an empty array.
 */

/**
 * Identifies an observation by its series and row indexes.
 * @typedef {Object} PointIndex
 * @property {number} seriesIndex Index into the plotted series and Y columns.
 * @property {number} index Row index into X and the selected Y column.
 */

/**
 * Additional geometry and ordering rules for point lookup.
 * @typedef {Object} NearestOptions
 * @property {function(number, number): number} [radiusAt] Marker radius for a series
 * and row, in logical chart units. Used in addition to the minimum hover distance.
 * @property {number} [maxRadius] Upper bound on radiusAt, defaulting to maxDistance.
 * @property {function(number, number, number, number): boolean} [hitTest] Test a series,
 * row, and marker-center-minus-pointer offsets (dx, dy) against the actual marker.
 * A true result takes priority over center distance. False still allows distance-based selection.
 * @property {number} [maxHitRadius] Horizontal search bound for hitTest, defaulting to maxRadius.
 * @property {function(number, number, number, number): boolean} [isAbove] Whether the
 * first series/row is drawn above the second. Defaults to lower series index, then higher row.
 */

/**
 * Line and marker rendering settings.
 * @typedef {Object} LineRenderOptions
 * @property {boolean} [showLines=true] Connect finite observations within each series.
 * @property {boolean} [showPoints=true] Draw point markers unless their shape is 'none'.
 * @property {number} [pointSize=7] Marker size in logical chart units.
 * @property {boolean} [dense=false] Deduplicate markers at the same backing pixel per
 * series and omit their outlines. Line reduction is applied independently of this flag.
 */

/**
 * Inputs for a tooltip placed within the plot rectangle.
 * @typedef {Object} TooltipOptions
 * @property {{x: number, y: number}} point Hovered data values.
 * @property {string} [name] Series label, displayed as 'Value' when omitted or empty.
 * @property {string} [color] Series color.
 * @property {MarkerShape} [marker] Series marker shape.
 * @property {string} [xLabel='X'] X value label.
 * @property {CoordinateMap} toX Data X to drawing X.
 * @property {CoordinateMap} toY Data Y to drawing Y.
 * @property {number} gap Distance from the point to the tooltip in logical chart units.
 * @property {PlotBounds} bounds Rectangle in which to keep the tooltip.
 */

/**
 * Prepared state retained between updates, redraws, and pointer events.
 * @typedef {Object} ChartView
 * @property {NumericColumns} columns Plotted columns after series filtering.
 * @property {ChartLayout} layout Shared coordinate conversions and measured legend.
 * @property {function(number): number} markerRadius Radius for one plotted series index.
 * @property {number} maxRadius Upper bound on marker radius.
 * @property {function(number, number, number, number): boolean} [hitTest] Marker geometry
 * check, restricted to drawn markers when markerRows is present.
 * @property {number} maxHitRadius Horizontal search radius including marker outlines.
 * @property {function(number, number, number, number): boolean} isAbove Drawing-order comparison.
 * @property {Array<SeriesStyle>} shownSeries Styles paired with the retained Y columns.
 * @property {('line'|'scatter')} type Resolved plot type.
 * @property {string} x_axis_label X label used by tooltips.
 * @property {CoordinateMap} toX Data X to drawing X.
 * @property {CoordinateMap} toY Data Y to drawing Y.
 * @property {PlotBounds} bounds Plot rectangle used to constrain tooltips.
 * @property {Array<RenderedTrend>} trends Evaluated fits for scatter series.
 * @property {ChartLabels} labels Resolved chart text.
 * @property {number} markerSize Marker size, or zero when line markers are hidden.
 * @property {boolean} dense Whether to draw filled, deduplicated markers with outlines disabled.
 * @property {Array<Uint8Array>|null} [markerRows] Dense-marker visibility bitsets from
 * the last draw, used to restrict geometric hits to painted markers. Bit (index & 7)
 * in byte (index >> 3) identifies a drawn row. These masks change with drawing resolution.
 */

/**
 * One color represented in three viewing conditions as OKLab [L, a, b] triples.
 * Simulated RGB values are clamped before conversion.
 * @typedef {Object} ColorAppearance
 * @property {string} hex Original six-digit #RRGGBB representation.
 * @property {Array<number>} normal OKLab coordinates for ordinary vision.
 * @property {Array<number>} protan Coordinates after the protan simulation matrix.
 * @property {Array<number>} deutan Coordinates after the deutan simulation matrix.
 */

/**
 * Cached automatic-color search space sampled from a 32-by-32-by-32 RGB grid.
 * @typedef {Object} ColorCandidates
 * @property {Array<string>} hex Candidate six-digit color strings.
 * @property {Float64Array} labs Nine coordinates per candidate, grouped as normal,
 * protan, and deutan [L, a, b] triples at offset index * 9.
 */

/**
 * A bounded sample of diagnostic details and an uncapped occurrence count.
 * @template T
 * @typedef {Object} DiagnosticBuffer
 * @property {Array<T>} items Retained details, limited to MAX_DIAGNOSTICS entries.
 * @property {number} count Total occurrences, including omitted details.
 */

/**
 * Canvas text style. When supplied, this replaces the theme's default text style.
 * @typedef {Object} ChartTextStyle
 * @property {number} size Font size in logical chart units.
 * @property {number} [weight=400] CSS numeric font weight.
 * @property {string} color Canvas text color.
 * @property {CanvasTextAlign} [align='left'] Alignment at the text anchor.
 */

/**
 * Shared drawing colors and text styles.
 * @typedef {Object} ChartTheme
 * @property {ChartTextStyle} title Title text style.
 * @property {ChartTextStyle} subtitle Subtitle text style.
 * @property {ChartTextStyle} label Axis, legend, and tooltip label style.
 * @property {string} axis Axis stroke color.
 * @property {string} gridline Gridline stroke color.
 * @property {string} outline Marker outline color.
 * @property {Object} tooltip Tooltip colors.
 * @property {string} tooltip.background Tooltip fill color.
 * @property {string} tooltip.border Tooltip border color.
 * @property {string} tooltip.text Tooltip primary text color.
 * @property {string} tooltip.muted Tooltip secondary text color.
 */
