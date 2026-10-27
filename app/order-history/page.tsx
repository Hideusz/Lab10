import { connection } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getMyOrders } from "@/lib/cart";
import { SignInPrompt } from "@/components/SignInPrompt";

export default async function OrderHistoryPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session?.user) {
    return (
      <div>
        <h1>Historia zamówień</h1>
        <SignInPrompt message="Zaloguj się przez GitHub, aby zobaczyć historię wyłącznie własnych zamówień." />
      </div>
    );
  }

  const orders = (await getMyOrders()) ?? [];

  return (
    <div>
      <h1>Historia zamówień</h1>
      {orders.length === 0 ? (
        <div
          style={{
            background: "var(--card-bg)",
            padding: "2rem",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
          }}
        >
          <p>Nie masz jeszcze żadnych złożonych zamówień.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <strong>Numer zamówienia:</strong> {order.orderNumber}
                  <br />
                  <span style={{ fontSize: "0.85rem", color: "#bdbdbd" }}>
                    Data: {new Date(order.createdAt).toLocaleString("pl-PL")}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span>
                    Status: <strong>{order.status}</strong>
                  </span>
                  <br />
                  <span
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      color: "var(--primary-color)",
                    }}
                  >
                    Suma: {(Number(order.totalAmount) / 100).toFixed(2)} zł
                  </span>
                </div>
              </div>

              <ul style={{ listStyle: "none", display: "grid", gap: "0.5rem" }}>
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span>
                      {item.productName}{" "}
                      <small style={{ color: "#999" }}>
                        (Kod: {item.productCode})
                      </small>
                    </span>
                    <span>
                      {item.quantity} szt. &times;{" "}
                      {(item.unitPrice / 100).toFixed(2)} zł ={" "}
                      <strong>{(Number(item.lineTotal) / 100).toFixed(2)} zł</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}