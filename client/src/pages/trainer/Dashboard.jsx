import { useEffect, useState } from "react";
import { getOrders } from "../../services/order.service";

const TrainerDashboard = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      const res = await getOrders();
      setOrders(res.data.data.orders || []);
    };
    fetch();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Khách của bạn</h2>

      {orders.map((o) => (
        <div key={o._id} className="border p-3 rounded-lg shadow-sm">
          <p>
            <b>{o.name}</b>
          </p>
          <p>Gói: {o.package}</p>
          <p>Còn: {o.sessions} buổi</p>
        </div>
      ))}
    </div>
  );
};

export default TrainerDashboard;
