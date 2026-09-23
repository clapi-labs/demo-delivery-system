import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Bike,
  BookOpen,
  Bot,
  ChefHat,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CircleX,
  Clock,
  ClipboardList,
  Eye,
  Globe,
  Smartphone,
  Hand,
  ImagePlus,
  Info,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  Search,
  SendHorizontal,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Íconos del portal (Lucide), todos con el mismo trazo y tamaño por defecto.
 * Envueltos con nombres propios para que cambiar de librería sea tocar solo
 * este archivo.
 */

type IconProps = { className?: string };

function wrap(Icon: LucideIcon) {
  return function PortalIcon({ className = "h-5 w-5" }: IconProps) {
    return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
  };
}

export const HomeIcon = wrap(LayoutDashboard);
export const OrdersIcon = wrap(ClipboardList);
export const ChatIcon = wrap(MessageCircle);
export const MenuBookIcon = wrap(BookOpen);
export const SearchIcon = wrap(Search);
export const ClockIcon = wrap(Clock);
export const ChevronRightIcon = wrap(ChevronRight);
export const ChevronLeftIcon = wrap(ChevronLeft);
export const ChevronDownIcon = wrap(ChevronDown);
export const ArrowRightIcon = wrap(ArrowRight);
export const ArrowUpIcon = wrap(ArrowUp);
export const ArrowDownIcon = wrap(ArrowDown);
export const CheckIcon = wrap(Check);
export const CloseIcon = wrap(X);
export const PlusIcon = wrap(Plus);
export const PhoneIcon = wrap(Phone);
export const PinIcon = wrap(MapPin);
export const BotIcon = wrap(Bot);
export const HandIcon = wrap(Hand);
export const SendIcon = wrap(SendHorizontal);
export const UndoIcon = wrap(Undo2);
export const ImageIcon = wrap(ImagePlus);
export const TagIcon = wrap(Tag);
export const TrashIcon = wrap(Trash2);
export const InfoIcon = wrap(Info);
export const SortIcon = wrap(ArrowUpDown);
export const StoreIcon = wrap(Store);
export const SwipeIcon = wrap(ChevronsRight);
export const EyeIcon = wrap(Eye);
export const WhatsappIcon = wrap(Smartphone);
export const WebIcon = wrap(Globe);

// Inicio: métricas y cocina.
export const SalesIcon = wrap(Banknote);
export const BagIcon = wrap(ShoppingBag);
export const ReceiptIcon = wrap(Receipt);
export const CancelIcon = wrap(CircleX);
export const TrendUpIcon = wrap(TrendingUp);
export const TrendDownIcon = wrap(TrendingDown);
export const ChefIcon = wrap(ChefHat);
export const BikeIcon = wrap(Bike);
