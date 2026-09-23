import Image from "next/image";

import { formatCOP, type CatalogProduct } from "@sistema/shared";

import { categoryImage } from "@/lib/category-images";

type Props = {
  product: CatalogProduct;
  quantity: number;
  onQuickAdd: () => void;
  onQuickRemove: () => void;
  onOpenOptions: () => void;
};

export function ProductCard({
  product,
  quantity,
  onQuickAdd,
  onQuickRemove,
  onOpenOptions,
}: Props) {
  const hasOptions = product.optionGroups.length > 0;

  return (
    <article className="group flex gap-4 border-b border-border py-5 sm:block sm:gap-0 sm:rounded-[10px] sm:border sm:bg-card sm:p-0 sm:pb-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[8px] bg-muted sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none sm:rounded-t-[10px]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- el catálogo es dinámico; next/image exige dominios remotos conocidos de antemano.
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:sm:scale-[1.03]"
          />
        ) : (
          <Image
            src={categoryImage(product.categorySlug)}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 33vw, 96px"
            className="object-cover transition-transform duration-500 group-hover:sm:scale-[1.03]"
          />
        )}
        {!product.available ? (
          <span className="absolute left-2 top-2 rounded-[4px] bg-background/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
            Agotado
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:px-4 sm:pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl leading-none text-foreground sm:text-2xl">
            {product.name}
          </h3>
          <span className="shrink-0 font-display text-lg leading-none text-accent sm:text-xl">
            {formatCOP(product.price)}
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-3 flex items-center sm:mt-4">
          {!product.available ? (
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              No disponible
            </span>
          ) : hasOptions ? (
            <button
              onClick={onOpenOptions}
              className="h-11 rounded-[8px] border border-border-strong bg-secondary px-5 text-sm font-semibold uppercase tracking-[0.12em] text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Personalizar
            </button>
          ) : quantity === 0 ? (
            <button
              onClick={onQuickAdd}
              className="h-11 rounded-[8px] border border-border-strong bg-secondary px-5 text-sm font-semibold uppercase tracking-[0.12em] text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Agregar
            </button>
          ) : (
            <div className="flex h-11 items-center gap-1 rounded-[8px] border border-primary/60 bg-secondary px-1">
              <button
                onClick={onQuickRemove}
                aria-label={`Quitar una ${product.name}`}
                className="h-9 w-10 rounded-[6px] text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                −
              </button>
              <span className="w-8 text-center font-display text-lg">{quantity}</span>
              <button
                onClick={onQuickAdd}
                aria-label={`Agregar una ${product.name}`}
                className="h-9 w-10 rounded-[6px] text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
