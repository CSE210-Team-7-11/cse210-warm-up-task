// Small inline SVG icons. All take `size` (px) and inherit `currentColor`.
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export function LeafLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 28V15" stroke="#4e8d6d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 16c0-6 3.5-9.5 9.5-9.5 0 6-3.5 9.5-9.5 9.5z" fill="#a6ca57" />
      <path d="M16 21c0-4.5-2.8-7.3-7.3-7.3 0 4.5 2.8 7.3 7.3 7.3z" fill="#95c15e" />
      <circle cx="21" cy="7" r="2.2" fill="#f7f6c5" />
    </svg>
  )
}

export function PencilIcon({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function PlusIcon({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function DownloadIcon({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

export function UploadIcon({ size = 18 }) {
  return (
    <svg {...base(size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5M12 3v12" />
    </svg>
  )
}

export function ScatterIcon({ size = 20 }) {
  return (
    <svg {...base(size)} strokeWidth={1.6}>
      <path d="M4 4v16h16" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="13" cy="9" r="1" fill="currentColor" />
      <circle cx="16" cy="14" r="1" fill="currentColor" />
      <circle cx="11" cy="16" r="1" fill="currentColor" />
      <circle cx="18" cy="7" r="1" fill="currentColor" />
    </svg>
  )
}

export function LineChartIcon({ size = 20 }) {
  return (
    <svg {...base(size)} strokeWidth={1.6}>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-5 3 3 5-6" />
    </svg>
  )
}

export function BarChartIcon({ size = 14 }) {
  return (
    <svg {...base(size)} strokeWidth={2.2}>
      <path d="M4 20V11M10 20V5M16 20v-7M22 20H2" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 12 }) {
  return (
    <svg {...base(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function ChevronUpIcon({ size = 12 }) {
  return (
    <svg {...base(size)}>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 12 }) {
  return (
    <svg {...base(size)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function EllipsisIcon({ size = 16 }) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

export function CheckCircleIcon({ size = 14 }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

export function ResetIcon({ size = 12 }) {
  return (
    <svg {...base(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}
