/**
 * El catálogo del restaurante (RF-03).
 *
 * **Sabor Urbano** — comida rápida. Todo inventado: nombres, precios y
 * productos. Se eligió comida rápida porque permite mostrar personalizaciones
 * (término, extras, acompañamiento), que es lo que separa un menú digital de
 * un catálogo plano.
 *
 * Dos productos arrancan **agotados** a propósito: hay que poder mostrar en el
 * video cómo se comporta el sistema con algo que no hay, tanto en el menú como
 * en la respuesta del asistente.
 *
 * Los datos del negocio (horario, domicilio, pagos) NO están acá: viven en
 * `config/business-info.ts`, que es lo que lee también el prompt del asistente.
 *
 * Precios en pesos colombianos, enteros.
 */

export type SeedOption = {
  name: string;
  priceDelta?: number;
};

export type SeedOptionGroup = {
  name: string;
  type: "single" | "multi";
  required?: boolean;
  options: SeedOption[];
};

export type SeedProduct = {
  sku: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  available?: boolean;
  optionGroups?: SeedOptionGroup[];
};

export type SeedCategory = {
  slug: string;
  name: string;
  emoji: string;
  products: SeedProduct[];
};

/** Grupos que se repiten. Declararlos una vez evita que se desincronicen. */
const TERMINO: SeedOptionGroup = {
  name: "Término de la carne",
  type: "single",
  required: true,
  options: [
    { name: "Término medio" },
    { name: "Tres cuartos" },
    { name: "Bien asada" },
  ],
};

const EXTRAS: SeedOptionGroup = {
  name: "Extras",
  type: "multi",
  options: [
    { name: "Tocineta", priceDelta: 4000 },
    { name: "Queso adicional", priceDelta: 3000 },
    { name: "Huevo", priceDelta: 2500 },
    { name: "Aguacate", priceDelta: 4000 },
    { name: "Cebolla caramelizada", priceDelta: 2000 },
  ],
};

const ACOMPANAMIENTO: SeedOptionGroup = {
  name: "Acompañamiento",
  type: "single",
  required: true,
  options: [
    { name: "Papas a la francesa" },
    { name: "Papas rústicas", priceDelta: 2000 },
    { name: "Ensalada", priceDelta: 3000 },
  ],
};

export const CATALOG: SeedCategory[] = [
  {
    slug: "hamburguesas",
    name: "Hamburguesas",
    emoji: "🍔",
    products: [
      {
        sku: "BURGER-CLASICA",
        name: "Hamburguesa Clásica",
        description:
          "Carne de res 150 g, queso cheddar, lechuga, tomate y salsa de la casa.",
        price: 18000,
        emoji: "🍔",
        optionGroups: [TERMINO, ACOMPANAMIENTO, EXTRAS],
      },
      {
        sku: "BURGER-DOBLE",
        name: "Doble Tocineta",
        description:
          "Doble carne, doble queso, tocineta crocante y salsa ahumada.",
        price: 26000,
        emoji: "🥓",
        optionGroups: [TERMINO, ACOMPANAMIENTO, EXTRAS],
      },
      {
        sku: "BURGER-COSTILLA",
        name: "Costilla BBQ",
        description:
          "Costilla desmechada en salsa BBQ, aros de cebolla y queso ahumado.",
        price: 24000,
        emoji: "🍖",
        optionGroups: [ACOMPANAMIENTO, EXTRAS],
      },
      {
        sku: "BURGER-POLLO",
        name: "Hamburguesa de Pollo",
        description:
          "Pechuga apanada, lechuga, tomate y mayonesa de hierbas.",
        price: 19000,
        emoji: "🍗",
        optionGroups: [ACOMPANAMIENTO, EXTRAS],
      },
      {
        sku: "BURGER-VEGGIE",
        name: "Hamburguesa Vegetariana",
        description:
          "Torta de garbanzo y quinua, aguacate, rúgula y alioli de limón.",
        price: 17000,
        emoji: "🥬",
        optionGroups: [ACOMPANAMIENTO, EXTRAS],
      },
    ],
  },
  {
    slug: "pollo",
    name: "Pollo",
    emoji: "🍗",
    products: [
      {
        sku: "POLLO-ALITAS-6",
        name: "Alitas x6",
        description: "Seis alitas bañadas en la salsa que elija.",
        price: 22000,
        emoji: "🍗",
        optionGroups: [
          {
            name: "Salsa",
            type: "single",
            required: true,
            options: [
              { name: "BBQ" },
              { name: "Búfalo" },
              { name: "Miel mostaza" },
              { name: "Maracuyá picante", priceDelta: 1500 },
            ],
          },
        ],
      },
      {
        sku: "POLLO-ALITAS-12",
        name: "Alitas x12",
        description: "Doce alitas, hasta dos salsas distintas.",
        price: 38000,
        emoji: "🔥",
        optionGroups: [
          {
            name: "Salsas",
            type: "multi",
            required: true,
            options: [
              { name: "BBQ" },
              { name: "Búfalo" },
              { name: "Miel mostaza" },
              { name: "Maracuyá picante", priceDelta: 1500 },
            ],
          },
        ],
      },
      {
        sku: "POLLO-BROASTER",
        name: "Pollo Broaster (1/4)",
        description: "Cuarto de pollo apanado, crocante por fuera y jugoso.",
        price: 16000,
        emoji: "🍗",
        optionGroups: [ACOMPANAMIENTO],
      },
      {
        sku: "POLLO-DEDITOS",
        name: "Deditos de Pollo",
        description: "Cinco deditos de pechuga apanados con salsa de la casa.",
        price: 15000,
        emoji: "🍤",
      },
      {
        sku: "POLLO-WRAP",
        name: "Wrap de Pollo Crispy",
        description:
          "Tortilla de trigo, pollo crispy, lechuga, tomate y ranch.",
        price: 17000,
        emoji: "🌯",
      },
    ],
  },
  {
    slug: "acompanamientos",
    name: "Acompañamientos",
    emoji: "🍟",
    products: [
      {
        sku: "ACOMP-PAPAS",
        name: "Papas a la Francesa",
        description: "Porción personal con sal marina.",
        price: 8000,
        emoji: "🍟",
      },
      {
        sku: "ACOMP-PAPAS-QUESO",
        name: "Papas con Queso y Tocineta",
        description: "Papas cubiertas con queso fundido y tocineta.",
        price: 13000,
        emoji: "🧀",
        optionGroups: [
          {
            name: "Extras",
            type: "multi",
            options: [
              { name: "Más tocineta", priceDelta: 4000 },
              { name: "Jalapeños", priceDelta: 2000 },
            ],
          },
        ],
      },
      {
        sku: "ACOMP-AROS",
        name: "Aros de Cebolla",
        description: "Ocho aros apanados con salsa de la casa.",
        price: 10000,
        emoji: "🧅",
      },
      {
        sku: "ACOMP-YUCA",
        name: "Yuca Frita",
        description: "Yuca crocante con suero costeño.",
        price: 9000,
        emoji: "🥔",
      },
      {
        sku: "ACOMP-ENSALADA",
        name: "Ensalada de la Casa",
        description: "Mix de hojas, tomate cherry, queso feta y vinagreta.",
        price: 11000,
        emoji: "🥗",
      },
    ],
  },
  {
    slug: "bebidas",
    name: "Bebidas",
    emoji: "🥤",
    products: [
      {
        sku: "BEB-GASEOSA",
        name: "Gaseosa 400 ml",
        description: "Botella personal bien fría.",
        price: 4000,
        emoji: "🥤",
        optionGroups: [
          {
            name: "Sabor",
            type: "single",
            required: true,
            options: [
              { name: "Cola" },
              { name: "Cola sin azúcar" },
              { name: "Naranja" },
              { name: "Manzana" },
            ],
          },
        ],
      },
      {
        sku: "BEB-LIMONADA",
        name: "Limonada Natural",
        description: "Limón exprimido al momento.",
        price: 6000,
        emoji: "🍋",
        optionGroups: [
          {
            name: "Tamaño",
            type: "single",
            required: true,
            options: [{ name: "Vaso" }, { name: "Jarra", priceDelta: 8000 }],
          },
        ],
      },
      {
        sku: "BEB-LIMONADA-COCO",
        name: "Limonada de Coco",
        description: "Limón, leche de coco y hielo triturado.",
        price: 9000,
        emoji: "🥥",
      },
      {
        sku: "BEB-JUGO",
        name: "Jugo Natural en Agua",
        description: "Mora, maracuyá o mango, según disponibilidad.",
        price: 7000,
        emoji: "🧃",
      },
      {
        sku: "BEB-MALTEADA",
        name: "Malteada",
        description: "Helado artesanal batido, con crema por encima.",
        price: 12000,
        emoji: "🥛",
        optionGroups: [
          {
            name: "Sabor",
            type: "single",
            required: true,
            options: [
              { name: "Vainilla" },
              { name: "Chocolate" },
              { name: "Fresa" },
              { name: "Oreo", priceDelta: 2000 },
            ],
          },
        ],
      },
      {
        sku: "BEB-CERVEZA",
        name: "Cerveza Nacional",
        description: "Botella 330 ml.",
        price: 7000,
        emoji: "🍺",
        // Agotada a propósito: el prospecto tiene que ver el manejo de stock.
        available: false,
      },
    ],
  },
  {
    slug: "postres",
    name: "Postres",
    emoji: "🍰",
    products: [
      {
        sku: "POSTRE-BROWNIE",
        name: "Brownie con Helado",
        description: "Brownie tibio, helado de vainilla y salsa de chocolate.",
        price: 12000,
        emoji: "🍫",
      },
      {
        sku: "POSTRE-CHEESECAKE",
        name: "Cheesecake de Maracuyá",
        description: "Porción individual con salsa de maracuyá.",
        price: 13000,
        emoji: "🍰",
      },
      {
        sku: "POSTRE-HELADO",
        name: "Copa de Helado",
        description: "Dos bolas con topping a elección.",
        price: 8000,
        emoji: "🍨",
        optionGroups: [
          {
            name: "Topping",
            type: "single",
            required: true,
            options: [
              { name: "Chocolate" },
              { name: "Arequipe" },
              { name: "Frutos rojos" },
            ],
          },
        ],
      },
      {
        sku: "POSTRE-OBLEA",
        name: "Oblea Gigante",
        description: "Arequipe, queso rallado y crema de leche.",
        price: 7000,
        emoji: "🥮",
        // La segunda agotada, en otra categoría.
        available: false,
      },
    ],
  },
];
