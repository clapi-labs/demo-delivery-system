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
  const inCart = quantity > 0;

  return (
    <article
      className={`group relative flex gap-4 border-b border-border py-5 transition-colors sm:block sm:gap-0 sm:rounded-[10px] sm:border sm:bg-card sm:p-0 sm:pb-4 ${
        inCart ? "sm:border-ember/55" : "sm:hover:border-border-strong"
      }`}
    >
      {/* Marca de pedido: el plato que ya va en el carrito se reconoce de un vistazo. */}
      {inCart ? (
        <span
          aria-hidden
          className="absolute -left-4 top-5 h-[calc(100%-2.5rem)] w-[2px] bg-ember sm:left-0 sm:top-0 sm:h-full sm:w-[3px] sm:rounded-l-[10px]"
        />
      ) : null}

      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[8px] bg-muted sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none sm:rounded-t-[10px]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- el catálogo es dinámico; next/image exige dominios remotos conocidos de antemano.
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:sm:scale-[1.04]"
          />
        ) : (
          <Image
            src={categoryImage(product.categorySlug)}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 33vw, 96px"
            className="object-cover transition-transform duration-500 ease-out group-hover:sm:scale-[1.04]"
          />
        )}
        {/* La foto se oscurece por abajo para que el nombre nunca quede sobre un claro. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-card to-transparent sm:block"
        />
        {!product.available ? (
          <span className="absolute left-2 top-2 rounded-[4px] border border-border bg-background/80 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground backdrop-blur-sm">
            Agotado
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:px-4 sm:pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="display-item min-w-0 text-flour">{product.name}</h3>
          <span className="display-price shrink-0 text-ember">{formatCOP(product.price)}</span>
        </div>

        <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-3 flex items-center sm:mt-4">
          {!product.available ? (
            <span className="text-sm text-muted-foreground">No disponible</span>
          ) : hasOptions ? (
            <button
              onClick={onOpenOptions}
              className="h-11 rounded-[8px] border border-border-strong bg-secondary px-5 text-sm font-medium text-secondary-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Personalizar
            </button>
          ) : quantity === 0 ? (
            <button
              onClick={onQuickAdd}
              className="h-11 rounded-[8px] border border-border-strong bg-secondary px-5 text-sm font-medium text-secondary-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Agregar
            </button>
          ) : (
            <div className="flex h-11 items-center gap-1 rounded-[8px] border border-ember/50 bg-secondary px-1">
              <button
                onClick={onQuickRemove}
                aria-label={`Quitar una ${product.name}`}
                className="h-9 w-10 rounded-[6px] text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                −
              </button>
              <span className="tnum w-8 text-center text-base font-semibold text-flour">
                {quantity}
              </span>
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
