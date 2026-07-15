export type ReturnAddress = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

export function getReturnAddress(): ReturnAddress | null {
  const name = process.env.RETURN_ADDRESS_NAME?.trim() || "Miłosz Czech";
  const street = process.env.RETURN_ADDRESS_STREET?.trim();
  const postalCode = process.env.RETURN_ADDRESS_POSTAL_CODE?.trim();
  const city = process.env.RETURN_ADDRESS_CITY?.trim();
  const country = process.env.RETURN_ADDRESS_COUNTRY?.trim() || "Polska";

  if (!street || !postalCode || !city || !country) {
    return null;
  }

  return {
    name,
    street,
    postalCode,
    city,
    country,
  };
}

export function getReturnAddressLines() {
  const address = getReturnAddress();

  if (!address) {
    return [];
  }

  return [
    address.name,
    address.street,
    `${address.postalCode} ${address.city}`,
    address.country,
  ];
}

export function getReturnShipmentInstructionLines(caseNumber?: string) {
  return [
    "Zabezpiecz paczkę tak, aby produkty nie uszkodziły się w transporcie.",
    "W środku umieść wszystkie produkty objęte zgłoszeniem.",
    caseNumber
      ? `Do paczki włóż kartkę z numerem sprawy: ${caseNumber}.`
      : "Do paczki włóż kartkę z numerem sprawy.",
    "Nadaj przesyłkę opłaconą z góry. Przesyłki za pobraniem lub z płatnością po stronie odbiorcy nie będą odbierane.",
  ];
}
