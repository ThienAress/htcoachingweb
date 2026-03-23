const Pricing = () => {
  return (
    <section id="pricing" className="p-10 bg-gray-100 text-center">
      <h2 className="text-3xl font-bold mb-6">Pricing</h2>
      <div className="flex justify-center gap-6">
        <div>
          <h3>Basic</h3>
          <p>$20/month</p>
        </div>
        <div>
          <h3>Pro</h3>
          <p>$40/month</p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
