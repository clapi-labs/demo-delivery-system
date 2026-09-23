import type { ReactNode } from "react";

/**
 * Íconos del portal, dibujados a mano en el mismo trazo (1.75, redondeado).
 * Sin librería: son pocos y así no se suma una dependencia al bundle.
 */

type IconProps = { className?: string };

function icon(paths: ReactNode) {
  return function Icon({ className = "h-5 w-5" }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const HomeIcon = icon(<path d="M4 11.5 12 4l8 7.5M6 9.5V20h12V9.5" />);

export const OrdersIcon = icon(
  <>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </>,
);

export const ChatIcon = icon(<path d="M4 5h16v11H9l-5 4V5Z" />);

export const MenuBookIcon = icon(
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
  </>,
);

export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </>,
);

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </>,
);

export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const ChevronRightIcon = icon(<path d="m9 6 6 6-6 6" />);
export const ChevronLeftIcon = icon(<path d="m15 6-6 6 6 6" />);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const ArrowRightIcon = icon(<path d="M5 12h14m-5-5 5 5-5 5" />);
export const ArrowUpIcon = icon(<path d="M12 19V5m-5 5 5-5 5 5" />);
export const ArrowDownIcon = icon(<path d="M12 5v14m-5-5 5 5 5-5" />);
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);

export const PhoneIcon = icon(
  <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z" />,
);

export const PinIcon = icon(
  <>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </>,
);

export const BotIcon = icon(
  <>
    <rect x="4.5" y="8" width="15" height="11" rx="3" />
    <path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16h5" />
  </>,
);

export const HandIcon = icon(
  <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.2 14.2a1.5 1.5 0 0 1 2.3-1.9L8 14" />,
);

export const PauseIcon = icon(<path d="M9 5v14M15 5v14" />);
export const PlayIcon = icon(<path d="M7 5v14l12-7L7 5Z" />);
export const SendIcon = icon(<path d="M4 12 20 4l-4 16-4-7-8-1Z" />);
export const UndoIcon = icon(<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />);

export const ImageIcon = icon(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m20.5 16-5-5-9 8.5" />
  </>,
);

export const TagIcon = icon(
  <>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.3 6.3a1.5 1.5 0 0 1-2.1 0l-8.6-8Z" />
    <circle cx="8" cy="8" r="1.4" />
  </>,
);

export const TrashIcon = icon(
  <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5" />,
);

export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </>,
);

export const SortIcon = icon(<path d="M8 4v16m0 0-3-3m3 3 3-3M16 20V4m0 0-3 3m3-3 3 3" />);

export const StoreIcon = icon(
  <>
    <path d="M4 9.5 5.5 4h13L20 9.5a2.7 2.7 0 0 1-5.3.5 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 9.5Z" />
    <path d="M5.5 12v8h13v-8" />
  </>,
);

export const SwipeIcon = icon(
  <>
    <path d="M4 8h11m-3-3 3 3-3 3" />
    <path d="M9 20v-6.5a1.5 1.5 0 0 1 3 0V16m0-2a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v1.5A3.5 3.5 0 0 1 14.5 20H9" />
  </>,
);
