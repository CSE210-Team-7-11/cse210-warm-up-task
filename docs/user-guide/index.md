# 78js

78js is a JavaScript charting library for line and scatter plots.

- [Getting started](getting-started.md): create and update a chart with a small dataset.
- [API reference](api.md): chart configuration, data requirements, and lifecycle methods.

## Using 78js

A chart is created in a page element by calling `createChart` with its data and configuration. The returned instance lets an application update the chart as its data or settings change, then remove it when the containing view is closed.

Each dataset is a series, with its own values, name, and appearance. Series share the X values, so a chart can compare several datasets over the same observations. Line and scatter plots use the same input format. The [getting-started example](getting-started.md#add-a-second-series) shows this relationship with sales and costs.

## Chart configuration

Options control titles, axis labels, colors, markers, point sizes, and scatter trend lines. Line charts also support dash patterns. Legends and hover tooltips identify the series and display point values.

Data is supplied as numeric arrays, with a choice of breaking a line or connecting across a missing observation. See [Data and series](api.md#data-and-series) for the input contract, and [Options](api.md#options) for appearance settings and defaults.

## Rendering and integration

78js draws each chart on a canvas. Chart options control the appearance of the series, labels, and legend. Use CSS to size the containing element; the chart resizes with it and accounts for the display's pixel density.

Create the chart once its container is ready, update it as data or settings change, and destroy it when its containing view is removed. See the [lifecycle reference](api.md#lifecycle) for these methods.
