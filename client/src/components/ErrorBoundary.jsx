import React from "react";
import { Helmet } from "react-helmet-async";
import { recoverStaleDynamicImport } from "../utils/chunkRecovery.js";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    recoverStaleDynamicImport(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <Helmet>
            <meta name="robots" content="noindex,nofollow" />
          </Helmet>
          <div
            data-app-fatal-error="true"
            data-nosnippet
            role="alert"
            className="min-h-screen flex items-center justify-center bg-gray-100 p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2 uppercase">
                Không thể tải trang
              </h1>
              <p className="text-gray-600 mb-4">
                Trang có thể vừa được cập nhật. Vui lòng tải lại để tiếp tục.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
