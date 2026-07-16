import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

export default function SEO({ title, description, canonical, type = 'website', image, noindex = false, jsonLd }) {
  const { i18n } = useTranslation();
  const siteName = "HTCOACHING";
  const defaultTitle = "HTCOACHING - HLV cá nhân: Gym, Boxing, Tăng cơ & Giảm mỡ";
  const defaultDescription = "Chương trình luyện tập cá nhân hóa cùng HLV chuyên nghiệp tại HTCOACHING. Boxing, Gym & cardio giúp tăng cơ giảm mỡ hiệu quả. Đăng ký tập ngay hôm nay!";
  const domain = "https://htcoachingweb.io.vn";
  const defaultImage = `${domain}/og-image.png`;
  
  // Tự động thêm brand vào title nếu có title truyền vào
  const seoTitle = title ? `${title} | ${siteName}` : defaultTitle;
  const seoDescription = description || defaultDescription;
  const seoImage = image || defaultImage;
  
  // Bảo vệ Canonical Tag: Bắt buộc xóa sạch query parameters (?...) và hash (#...)
  const cleanCanonical = canonical ? canonical.split('?')[0].split('#')[0] : '';

  // og:locale dựa trên ngôn ngữ hiện tại
  const currentLocale = i18n.language === 'en' ? 'en_US' : 'vi_VN';
  const alternateLocale = i18n.language === 'en' ? 'vi_VN' : 'en_US';

  // An toàn JSON-LD chống XSS (escape ký tự nhạy cảm)
  const safeJsonLd = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : null;
  
  return (
    <Helmet>
      {/* HTML lang attribute — giúp screen readers và SEO */}
      <html lang={i18n.language} />

      {/* Chặn index nếu là trang hệ thống (noindex=true) */}
      {noindex
        ? <meta name="robots" content="noindex,nofollow" />
        : <meta name="robots" content="index,follow" />
      }

      {/* Thẻ SEO Cơ bản */}
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      
      {/* URL Chuẩn (Canonical) - chỉ thêm khi không phải noindex */}
      {!noindex && cleanCanonical && <link rel="canonical" href={`${domain}${cleanCanonical}`} />}

      {/* Hreflang — báo Google biết trang có 2 phiên bản ngôn ngữ */}
      {!noindex && cleanCanonical && (
        <>
          <link rel="alternate" hrefLang="vi" href={`${domain}${cleanCanonical}`} />
          <link rel="alternate" hrefLang="en" href={`${domain}${cleanCanonical}`} />
          <link rel="alternate" hrefLang="x-default" href={`${domain}${cleanCanonical}`} />
        </>
      )}
      
      {/* Open Graph (Facebook, Zalo) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {!noindex && cleanCanonical && <meta property="og:url" content={`${domain}${cleanCanonical}`} />}
      <meta property="og:locale" content={currentLocale} />
      <meta property="og:locale:alternate" content={alternateLocale} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      {/* JSON-LD Structured Data */}
      {safeJsonLd && (
        <script type="application/ld+json">
          {safeJsonLd}
        </script>
      )}
    </Helmet>
  );
}

