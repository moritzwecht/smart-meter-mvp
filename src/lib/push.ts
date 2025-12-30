const publicVapidKey = "BBb2t3PWudF0WXr9eKOJ7KG-H6Y014K8aHkbx9ip-wJxt0OPyRzgXzyUXHYHHhW1y6jBMJQQ7e5nAieNhU9pvyo";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeUserToPush() {
    if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            return existingSubscription;
        }

        const subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        };

        const subscription = await registration.pushManager.subscribe(subscribeOptions);

        // Send subscription to server
        await fetch("/api/push/subscribe", {
            method: "POST",
            body: JSON.stringify(subscription),
            headers: {
                "Content-Type": "application/json"
            }
        });

        return subscription;
    }
    throw new Error("Service worker not supported");
}

export async function checkPushPermission(): Promise<"granted" | "denied" | "default"> {
    if (!("Notification" in window)) {
        return "denied";
    }
    return Notification.permission;
}
