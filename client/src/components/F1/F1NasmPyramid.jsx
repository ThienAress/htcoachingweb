const F1NasmPyramid = () => {
  return (
    <>
      <style>{`
        .opt-page {
          background: linear-gradient(145deg, #e0e5ec 0%, #f0f4fa 100%);
          min-height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          padding: 2rem;
        }

        .opt-container {
          background: rgba(255,255,255,0.3);
          border-radius: 3rem;
          padding: 2rem 1.5rem 1.8rem 1.5rem;
          box-shadow: 0 25px 40px rgba(0,0,0,0.2);
          backdrop-filter: blur(2px);
          width: 100%;
        }

        .opt-pyramid {
          max-width: 750px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .opt-phase {
          width: 100%;
          text-align: center;
          font-weight: bold;
          padding: 1rem 0.5rem;
          margin-bottom: 0.5rem;
          border-radius: 20px;
          transition: transform 0.2s ease, box-shadow 0.2s;
          color: #1e2a3a;
          letter-spacing: 1px;
          font-size: 1.1rem;
          box-shadow: 0 5px 12px rgba(0,0,0,0.1);
          position: relative;
        }

        .opt-phase::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 12px;
          border-radius: 20px 0 0 20px;
        }

        .opt-phase-1::before {
          background: #9b59b6;
        }

        .opt-phase-2::before,
        .opt-phase-3::before,
        .opt-phase-4::before {
          background: #2c3e50;
        }

        .opt-phase-5::before {
          background: #e67e22;
        }

        .opt-phase-5 {
          width: 22%;
          background: linear-gradient(135deg, #ff9a2e, #ffb347);
          border-bottom: 4px solid #e07c1f;
        }

        .opt-phase-4 {
          width: 38%;
          background: linear-gradient(135deg, #f1c40f, #e67e22);
          border-bottom: 4px solid #d35400;
        }

        .opt-phase-3 {
          width: 54%;
          background: linear-gradient(135deg, #27ae60, #2ecc71);
          border-bottom: 4px solid #1e8449;
        }

        .opt-phase-2 {
          width: 70%;
          background: linear-gradient(135deg, #2980b9, #3498db);
          border-bottom: 4px solid #1f618d;
        }

        .opt-phase-1 {
          width: 86%;
          background: linear-gradient(135deg, #8e44ad, #9b59b6);
          border-bottom: 4px solid #6c3483;
          margin-bottom: 1.8rem;
        }

        .opt-phase-label {
          position: absolute;
          right: -85px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.65);
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 30px;
          white-space: nowrap;
          backdrop-filter: blur(4px);
          pointer-events: none;
          letter-spacing: 0.5px;
        }

        .opt-pillars {
          display: flex;
          justify-content: center;
          gap: 2.5rem;
          margin-top: 2rem;
          flex-wrap: wrap;
        }

        .opt-pillar {
          color: white;
          padding: 0.7rem 2rem;
          border-radius: 60px;
          font-weight: bold;
          font-size: 1.2rem;
          letter-spacing: 2px;
          box-shadow: 0 6px 0 #1a2632;
          transition: all 0.1s linear;
          text-transform: uppercase;
          min-width: 140px;
          text-align: center;
        }

        .opt-pillar:nth-child(1) {
          background: #e67e22;
          box-shadow: 0 6px 0 #b45f1b;
        }

        .opt-pillar:nth-child(2) {
          background: #2c3e50;
          box-shadow: 0 6px 0 #1e2a36;
        }

        .opt-pillar:nth-child(3) {
          background: #9b59b6;
          box-shadow: 0 6px 0 #6c3483;
        }

        .opt-sub {
          text-align: center;
          margin-top: 2rem;
          font-weight: 600;
          color: #2c3e50;
          background: rgba(255,255,240,0.8);
          display: inline-block;
          width: auto;
          padding: 0.5rem 1.8rem;
          border-radius: 60px;
          font-size: 0.85rem;
          backdrop-filter: blur(4px);
        }

        .opt-phase:hover {
          transform: scale(1.01);
          filter: brightness(1.02);
          cursor: default;
        }

        @media (max-width: 680px) {
          .opt-phase-label {
            display: none;
          }

          .opt-phase:hover::after {
            content: attr(data-group);
            position: absolute;
            right: 10px;
            top: -25px;
            background: #000;
            color: #fff;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 12px;
            white-space: nowrap;
          }
        }

        @media (max-width: 550px) {
          .opt-page {
            padding: 1rem;
          }

          .opt-phase {
            font-size: 0.85rem;
            padding: 0.7rem 0.3rem;
          }

          .opt-pillar {
            padding: 0.4rem 1rem;
            font-size: 0.9rem;
            min-width: 100px;
          }

          .opt-pillars {
            gap: 1rem;
          }

          .opt-phase::before {
            width: 8px;
          }
        }
      `}</style>

      <div className="opt-page">
        <div className="opt-container">
          <div className="opt-pyramid">
            <div className="opt-phase opt-phase-5" data-group="⚡ POWER">
              ⚡ PHASE 5: POWER
              <span className="opt-phase-label">POWER</span>
            </div>

            <div className="opt-phase opt-phase-4" data-group="💪 STRENGTH">
              💪 PHASE 4: MAXIMAL STRENGTH
              <span className="opt-phase-label">STRENGTH</span>
            </div>

            <div className="opt-phase opt-phase-3" data-group="🏋️ STRENGTH">
              🏋️ PHASE 3: HYPERTROPHY
              <span className="opt-phase-label">STRENGTH</span>
            </div>

            <div className="opt-phase opt-phase-2" data-group="🔁 STRENGTH">
              🔁 PHASE 2: STRENGTH ENDURANCE
              <span className="opt-phase-label">STRENGTH</span>
            </div>

            <div
              className="opt-phase opt-phase-1"
              data-group="🧘 STABILIZATION"
            >
              🧘 PHASE 1: STABILIZATION ENDURANCE
              <span className="opt-phase-label">STABILIZATION</span>
            </div>

            <div className="opt-pillars">
              <div className="opt-pillar">POWER</div>
              <div className="opt-pillar">STRENGTH</div>
              <div className="opt-pillar">STABILIZATION</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default F1NasmPyramid;
