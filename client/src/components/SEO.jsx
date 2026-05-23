import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, canonical, type = 'website', image, noindex = false, jsonLd }) {
  const siteName = "HTCOACHING";
  const defaultTitle = "HTCOACHING - HLV cá nhân: Gym, Boxing, Tăng cơ & Giảm mỡ";
  const defaultDescription = "Chương trình luyện tập cá nhân hóa cùng HLV chuyên nghiệp tại HTCOACHING. Boxing, Gym & cardio giúp tăng cơ giảm mỡ hiệu quả. Đăng ký tập ngay hôm nay!";
  const domain = "https://htcoachingweb.io.vn"; // Domain của bạn
  
  // Tự động thêm brand vào title nếu có title truyền vào
  const seoTitle = title ? `${title} | ${siteName}` : defaultTitle;
  const seoDescription = description || defaultDescription;
  
  return (
    <Helmet>
      {/* Chặn index nếu là trang hệ thống (noindex=true) */}
      {noindex
        ? <meta name="robots" content="noindex,nofollow" />
        : <meta name="robots" content="index,follow" />
      }

      {/* Thẻ SEO Cơ bản */}
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      
      {/* URL Chuẩn (Canonical) - chỉ thêm khi không phải noindex */}
      {!noindex && canonical && <link rel="canonical" href={`${domain}${canonical}`} />}
      
      {/* Open Graph (Facebook, Zalo) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:site_name" content={siteName} />
      {image && <meta property="og:image" content={image} />}
      {!noindex && canonical && <meta property="og:url" content={`${domain}${canonical}`} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      {image && <meta name="twitter:image" content={image} />}

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
