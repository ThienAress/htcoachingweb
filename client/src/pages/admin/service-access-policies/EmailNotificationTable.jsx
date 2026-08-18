export default function EmailNotificationTable({ catalog }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <caption className="sr-only">
          Danh sách tính năng đang gửi email tự động trong hệ thống
        </caption>
        <thead className="bg-zinc-100 text-sm text-zinc-700">
          <tr>
            <th scope="col" className="w-[20%] px-5 py-4 font-semibold">
              Tính năng
            </th>
            <th scope="col" className="w-[24%] px-5 py-4 font-semibold">
              Khi nào gửi
            </th>
            <th scope="col" className="w-[14%] px-5 py-4 font-semibold">
              Người nhận
            </th>
            <th scope="col" className="w-[22%] px-5 py-4 font-semibold">
              Điều kiện
            </th>
            <th scope="col" className="w-[20%] px-5 py-4 font-semibold">
              Cách gửi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {catalog.items.map((item) => (
            <tr key={item.notificationKey} className="align-top">
              <th scope="row" className="px-5 py-5">
                <p className="font-bold text-zinc-950">{item.feature}</p>
                <p className="mt-1 font-mono text-xs font-medium text-emerald-800">
                  {item.templateKey}
                </p>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  {item.sender}
                </p>
              </th>
              <td className="px-5 py-5 text-sm leading-6 text-zinc-700">
                {item.trigger}
              </td>
              <td className="px-5 py-5 text-sm font-semibold text-zinc-900">
                {item.recipient}
              </td>
              <td className="px-5 py-5 text-sm leading-6 text-zinc-700">
                {item.condition}
              </td>
              <td className="px-5 py-5 text-sm leading-6 text-zinc-700">
                {item.delivery}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
