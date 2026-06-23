/** Lien WhatsApp avec message pré-rempli */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("243") ? digits : digits.startsWith("0") ? `243${digits.slice(1)}` : `243${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function orderWhatsAppMessage(orderNumber: string, clientName: string): string {
  return `Bonjour ${clientName}, c'est votre livreur Angelina Shapper pour la commande ${orderNumber}. Je suis en route pour votre livraison.`;
}
