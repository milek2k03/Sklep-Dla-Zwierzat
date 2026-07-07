-- Clean public product descriptions and feature copy.
-- Run after 028_remove_inpost_shipx_integration.sql.

with product_copy(
  sku,
  slug,
  description,
  features
) as (
  values
    (
      'PWL-BND-SPACER-DOG',
      'zestaw-spacer-premium-dla-psa',
      'Saszetka, miska i etui na woreczki w jednym zestawie na spacer.',
      array[
        'saszetka na smaczki',
        'składana miska silikonowa',
        'etui na woreczki',
        'na spacer i krótki wyjazd'
      ]
    ),
    (
      'PWL-BND-SPACER-PREMIUM',
      'zestaw-spacer-premium-dla-psa',
      'Saszetka, miska i etui na woreczki w jednym zestawie na spacer.',
      array[
        'saszetka na smaczki',
        'składana miska silikonowa',
        'etui na woreczki',
        'na spacer i krótki wyjazd'
      ]
    ),
    (
      'PWL-BND-AUTO-DOG',
      'zestaw-czyste-auto-dla-psa',
      'Akcesoria do podróży samochodem z psem i łatwiejszego sprzątania auta.',
      array[
        'pokrowiec do auta',
        'mniej sierści i piasku na siedzeniach',
        'łatwiejsze sprzątanie po podróży'
      ]
    ),
    (
      'PWL-BND-AUTO-CLEAN',
      'zestaw-czyste-auto-dla-psa',
      'Akcesoria do podróży samochodem z psem i łatwiejszego sprzątania auta.',
      array[
        'pokrowiec do auta',
        'mniej sierści i piasku na siedzeniach',
        'łatwiejsze sprzątanie po podróży'
      ]
    ),
    (
      'PWL-HOME-BOWL-MAT',
      'mata-pod-miski-dla-psa-lub-kota',
      'Mata pod miski, która chroni podłogę przed wodą i karmą.',
      array[
        'chroni podłogę',
        'łatwe czyszczenie',
        'prosty wygląd'
      ]
    ),
    (
      'PWL-TRAVEL-FOLD-BOWL',
      'skladana-miska-silikonowa',
      'Składana miska na wodę lub karmę, dobra na spacer i wyjazd.',
      array[
        'składana konstrukcja',
        'łatwa do opłukania',
        'na spacer, auto i wyjazd'
      ]
    ),
    (
      'PWL-ACC-FOLD-BOWL',
      'skladana-miska-silikonowa',
      'Składana miska na wodę lub karmę, dobra na spacer i wyjazd.',
      array[
        'składana konstrukcja',
        'łatwa do opłukania',
        'na spacer, auto i wyjazd'
      ]
    ),
    (
      'PWL-HOME-MICRO-TOWEL',
      'recznik-z-mikrofibry-dla-pupila',
      'Ręcznik z mikrofibry do osuszenia psa lub kota po spacerze i kąpieli.',
      array[
        'szybko chłonie wilgoć',
        'miękki dla sierści',
        'zajmuje mało miejsca'
      ]
    ),
    (
      'PWL-TRAVEL-PET-ORGANIZER',
      'organizer-na-akcesoria-pupila',
      'Organizer na smycz, woreczki, przysmaki i drobne akcesoria.',
      array[
        'miejsce na spacerowe akcesoria',
        'łatwy dostęp w domu i aucie',
        'porządek w akcesoriach'
      ]
    ),
    (
      'PWL-ACC-BAG-HOLDER',
      'organizer-na-akcesoria-pupila',
      'Organizer na smycz, woreczki, przysmaki i drobne akcesoria.',
      array[
        'miejsce na spacerowe akcesoria',
        'łatwy dostęp w domu i aucie',
        'porządek w akcesoriach'
      ]
    ),
    (
      'PWL-ACC-PET-BANDANA',
      'bandana-dla-psa-lub-kota',
      'Lekka bandana dla psa lub kota, dobra na spacer i do zdjęć.',
      array[
        'lekki materiał',
        'prosty sposób zapięcia',
        'na spacer i zdjęcia'
      ]
    ),
    (
      'PWL-ACC-DOG-BANDANA',
      'bandana-dla-psa-lub-kota',
      'Lekka bandana dla psa lub kota, dobra na spacer i do zdjęć.',
      array[
        'lekki materiał',
        'prosty sposób zapięcia',
        'na spacer i zdjęcia'
      ]
    ),
    (
      'PWL-BND-CAT-HOME',
      'zestaw-domowy-dla-kota',
      'Mata, ręcznik i organizer w jednym zestawie dla kota.',
      array[
        'mata pod miski',
        'ręcznik z mikrofibry',
        'organizer na drobiazgi',
        'zestaw do domu'
      ]
    ),
    (
      'PWL-ACC-TREAT-POUCH',
      'zestaw-domowy-dla-kota',
      'Mata, ręcznik i organizer w jednym zestawie dla kota.',
      array[
        'mata pod miski',
        'ręcznik z mikrofibry',
        'organizer na drobiazgi',
        'zestaw do domu'
      ]
    )
)
update public.products as product
set
  description = product_copy.description,
  features = product_copy.features
from product_copy
where product.sku = product_copy.sku
  or product.slug = product_copy.slug;
