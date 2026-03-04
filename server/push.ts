import webpush from "web-push";
import { storage } from "./storage";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@tutorpay.app";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

async function sendToUser(userId: string, payload: object): Promise<void> {
  const subs = await storage.getPushSubscriptionsByUserId(userId);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await storage.deletePushSubscription(sub.endpoint);
      }
    }
  }
}

async function sendToRole(role: string, payload: object): Promise<void> {
  const subs = await storage.getPushSubscriptionsByRole(role);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await storage.deletePushSubscription(sub.endpoint);
      }
    }
  }
}

export async function notifyPaymentStatusChange(
  tutorId: string,
  status: string,
  amount: string,
  currencyCode: string
): Promise<void> {
  const statusText = status === "verified" ? "Pago Verificado" : status === "rejected" ? "Pago Rechazado" : "Estado Actualizado";
  const icon = status === "verified" ? "✅" : status === "rejected" ? "❌" : "📋";
  
  await sendToUser(tutorId, {
    title: `${icon} ${statusText}`,
    body: `Tu pago de ${amount} ${currencyCode} ha sido ${status === "verified" ? "verificado" : status === "rejected" ? "rechazado" : "actualizado"}.`,
    tag: `payment-status-${Date.now()}`,
    url: "/tutor",
  });
}

export async function notifyNewPaymentRequest(
  tutorName: string,
  amount: string,
  currencyCode: string,
  verifierId?: string | null
): Promise<void> {
  await sendToRole("admin", {
    title: "📥 Nueva Solicitud de Pago",
    body: `${tutorName} ha registrado un pago de ${amount} ${currencyCode}. Pendiente de verificación.`,
    tag: `new-payment-${Date.now()}`,
    url: "/admin/payments",
  });

  if (verifierId) {
    await sendToUser(verifierId, {
      title: "📥 Solicitud de Verificación",
      body: `${tutorName} ha registrado un pago de ${amount} ${currencyCode}.`,
      tag: `verify-payment-${Date.now()}`,
      url: "/verifier",
    });
  } else {
    await sendToRole("verifier", {
      title: "📥 Solicitud de Verificación",
      body: `${tutorName} ha registrado un pago de ${amount} ${currencyCode}.`,
      tag: `verify-payment-${Date.now()}`,
      url: "/verifier",
    });
  }
}
