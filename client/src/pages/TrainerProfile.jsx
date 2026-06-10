import { useEffect, useState, useRef } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicTrainerBySlug } from "../services/trainer.service";
import { getPublicCustomerStories } from "../services/customerStory.service";
import { 
  ArrowRight,
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Dumbbell, 
  CheckCircle2, 
  Play,
  MessageCircle,
  Brain,
  Salad,
  Award,
  Trophy,
  Quote,
  Eye
} from "lucide-react";
import SEO from "../components/SEO";

/* ==========================================
   Component: Gallery ảnh HLV (tối đa 3 ảnh)
   ========================================== */
const TrainerGallery = ({ images, name }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const allImages = images?.length > 0 ? images : [];

  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % allImages.length);
    }, 3500); // 3.5 seconds
    return () => clearInterval(interval);
  }, [allImages.length]);

  if (allImages.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Ảnh chính lớn */}
      <div className="relative aspect-[3/4] md:aspect-square lg:aspect-[4/5] bg-slate-800 shadow-2xl rounded-2xl overflow-hidden group">
        {allImages.map((img, idx) => (
          <img 
            key={idx}
            src={img} 
            alt={`${name} - Ảnh ${idx + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-8 z-20 pointer-events-none">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase">{name}</h2>
          </div>
        </div>

        {/* Nút chuyển ảnh */}
        {allImages.length > 1 && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <button
              onClick={() => setActiveIdx((prev) => (prev - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 pointer-events-auto"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setActiveIdx((prev) => (prev + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 pointer-events-auto"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================
   Component: FAQ Accordion
   ========================================== */
const AccordionItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-4">
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 text-left bg-white transition-colors hover:bg-slate-50">
      <span className="font-bold text-slate-800 text-lg pr-4">{question}</span>
      <div className={`shrink-0 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-primary transition-transform duration-300 ${isOpen ? 'rotate-180 bg-primary/10' : ''}`}>
        <ChevronDown size={20} />
      </div>
    </button>
    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-5 pt-0 text-slate-600 leading-relaxed">{answer}</div>
    </div>
  </div>
);

/* ==========================================
   Component: Customer Grid Card (UI theo mẫu)
   ========================================== */
const CustomerCard = ({ story }) => (
  <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200">
    {/* Ảnh Before / After cạnh nhau */}
    <div className="flex">
      {/* Before */}
      <div className="flex-1 relative">
        <div className="aspect-[3/4] overflow-hidden">
          <img 
            src={story.beforeImg || story.heroImage || "https://placehold.co/400x500/1e293b/94a3b8?text=Before"} 
            alt="Before" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        </div>
        <div className="absolute bottom-4 left-0 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-r-lg uppercase tracking-widest shadow-lg z-20">
          BEFORE
        </div>
      </div>
      
      {/* Divider */}
      <div className="w-[2px] bg-slate-100 shrink-0 relative z-10"></div>
      
      {/* After */}
      <div className="flex-1 relative">
        <div className="aspect-[3/4] overflow-hidden">
          <img 
            src={story.afterImg || story.heroImage || "https://placehold.co/400x500/1e293b/94a3b8?text=After"} 
            alt="After" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        </div>
        <div className="absolute bottom-4 right-0 bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-l-lg uppercase tracking-widest shadow-lg z-20">
          AFTER
        </div>
      </div>
    </div>

    {/* Overlay nút Xem chi tiết — hiện khi hover */}
    <Link 
      to={`/ket-qua-khach-hang/${story.slug}`}
      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30"
    >
      <span className="flex items-center gap-2 bg-white text-slate-900 font-black px-6 py-3 rounded-xl shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
        <Eye size={18} /> XEM CHI TIẾT
      </span>
    </Link>

    {/* Footer: Thiết kế Vát chéo giống Image 2 */}
    <div className="flex bg-white h-12 relative border-t border-slate-100 overflow-hidden">
      <div className="flex-1 flex items-center px-4 font-bold text-slate-800 text-sm z-10 whitespace-nowrap overflow-hidden text-ellipsis">
        {story.name}{story.age ? `, ${story.age} tuổi` : ''}
      </div>
      {story.duration && (
        <div 
          className="flex items-center justify-end px-5 bg-primary text-white text-xs font-bold z-20 shrink-0"
          style={{ clipPath: 'polygon(20px 0, 100% 0, 100% 100%, 0 100%)', paddingLeft: '28px' }}
        >
          Thời gian: {story.duration}
        </div>
      )}
    </div>
  </div>
);

/* ==========================================
   Icon map cho specialties
   ========================================== */
const iconMap = {
  "dumbbell": Dumbbell,
  "utensils": Salad,
  "chart-line": Brain,
  "heart-pulse": Award,
};

/* ==========================================
   TRANG CHÍNH: Trainer Profile
   ========================================== */
const TrainerProfile = ({ previewData }) => {
  const { slug } = useParams();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const { data: trainerResponse, isLoading: isLoadingTrainer } = useQuery({
    queryKey: ["public-trainer-detail", slug],
    queryFn: () => getPublicTrainerBySlug(slug),
    retry: false,
    enabled: !previewData,
  });

  const trainer = previewData || trainerResponse?.data;

  const { data: storiesResponse } = useQuery({
    queryKey: ["public-customer-stories", { trainerId: trainer?._id }],
    queryFn: () => getPublicCustomerStories({ trainerId: trainer?._id, limit: 50 }),
    enabled: !!trainer?._id && !previewData,
  });

  const stories = previewData ? [] : (storiesResponse?.data || []);

  // Backward compatible: dùng images[] nếu có, fallback image cũ
  const trainerImages = trainer?.images?.length > 0 
    ? trainer.images 
    : (trainer?.image ? [trainer.image] : []);

  if (!previewData && isLoadingTrainer) {
    return (
      <main className="min-h-screen bg-[#1a1a1a] pt-32">
        <div className="container-custom flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (!trainer) return <Navigate to="/#trainers" replace />;

  const zaloLink = trainer.socialLinks?.zalo 
    ? (trainer.socialLinks.zalo.startsWith('http') ? trainer.socialLinks.zalo : `https://zalo.me/${trainer.socialLinks.zalo}`) 
    : null;

  return (
    <main className="bg-slate-100 min-h-screen font-sans">
      <SEO 
        title={`${trainer.name} - ${trainer.title || 'Huấn luyện viên'} | HTCOACHING`}
        description={trainer.headline || trainer.bio || `Huấn luyện viên ${trainer.name} tại HTCOACHING.`}
        image={trainerImages[0]}
        canonical={`/huan-luyen-vien/${trainer.slug}`}
      />

      {/* =============================================
          1. HERO SECTION — Nền tối, Gallery ảnh
          ============================================= */}
      <section className="bg-[#1a1a1a] pt-32 md:pt-40 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none blur-3xl"></div>
        
        <div className="container-custom relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            
            {/* Cột thông tin */}
            <div className="order-2 lg:order-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary font-bold text-sm tracking-wide border border-primary/30 rounded-full">
                🥇 {trainer.title || "Huấn Luyện Viên Chuyên Nghiệp"}
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] uppercase">
                {trainer.headline || trainer.name}
              </h1>

              {/* Châm ngôn (Motto) */}
              {trainer.motto && (
                <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
                  <Quote size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-lg text-slate-200 italic font-medium leading-relaxed">"{trainer.motto}"</p>
                </div>
              )}


              {/* Phong cách huấn luyện */}
              {trainer.trainingStyle && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-primary tracking-[0.15em] uppercase">Phong cách huấn luyện</h3>
                  <p className="text-slate-300 leading-relaxed border-l-2 border-primary/50 pl-4 py-1">{trainer.trainingStyle}</p>
                </div>
              )}

              {trainer.stats?.length > 0 && <hr className="border-white/10" />}

              {/* Stats */}
              {trainer.stats?.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
                  {trainer.stats.map((stat, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-4xl font-black text-white">{stat.value}</span>
                      <span className="text-sm font-semibold text-primary mt-1">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {(trainer.achievements?.length > 0 || trainer.specialties?.length > 0) && <hr className="border-white/10" />}

              {/* Thành tích nổi bật */}
              {trainer.achievements?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">
                    Thành tích nổi bật
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trainer.achievements.map((ach, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-slate-300 text-sm leading-relaxed">{ach}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trainer.specialties?.length > 0 && trainer.achievements?.length > 0 && <hr className="border-white/10" />}

              {/* Chuyên môn */}
              {trainer.specialties?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">Chuyên môn & Dịch vụ</h3>
                  <div className="flex flex-wrap gap-2">
                    {trainer.specialties.map((spec, i) => {
                      const IconComp = iconMap[spec.icon] || Dumbbell;
                      return (
                        <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-primary hover:border-primary transition-colors cursor-default group">
                          <IconComp size={16} className="text-primary group-hover:text-white transition-colors" />
                          <span className="font-semibold text-white text-sm">{spec.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {trainer.certifications?.length > 0 && <hr className="border-white/10" />}

              {/* Chứng chỉ */}
              {trainer.certifications?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 tracking-[0.15em] uppercase">Chứng chỉ & Đào tạo</h3>
                  <div className="space-y-2">
                    {trainer.certifications.map((cert, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">{cert}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link 
                  to="/#contact"
                  className="inline-flex items-center justify-center bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-colors shadow-xl shadow-primary/30 gap-2"
                >
                  <Dumbbell size={20} /> Đăng ký tư vấn miễn phí
                </Link>
                {stories.length > 0 && (
                  <a 
                    href="#customer-results"
                    className="inline-flex items-center justify-center bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-colors gap-2 border border-white/10"
                  >
                    Xem kết quả lột xác <Play size={18} className="fill-white" />
                  </a>
                )}
              </div>
            </div>

            {/* Cột Gallery ảnh */}
            <div className="order-1 lg:order-2">
              <TrainerGallery images={trainerImages} name={trainer.name} />
            </div>

          </div>
        </div>
      </section>

      {/* =============================================
          2. PHƯƠNG PHÁP CỦA TÔI (DYNAMIC)
          ============================================= */}
      {trainer.methodologies?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container-custom">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-slate-900 uppercase">Phương pháp huấn luyện</h2>
              <p className="text-lg text-slate-500 font-medium mt-4">Các trụ cột giúp bạn đạt kết quả bền vững.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trainer.methodologies.map((method, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full transition-all group-hover:bg-primary/10"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-white border-2 border-slate-200 text-slate-400 font-black text-2xl rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-primary group-hover:text-primary transition-all shadow-sm">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <h3 className="text-xl font-black uppercase text-slate-900 mb-4 tracking-wide">{method.title}</h3>
                    <p className="text-slate-600 leading-relaxed font-medium">{method.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =============================================
          3. KẾT QUẢ KHÁCH HÀNG — Grid Before/After
          Hiển thị TẤT CẢ khách hàng của HLV
          ============================================= */}
      {stories.length > 0 && (
        <section id="customer-results" className="py-20 bg-[#1a1a1a] relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          
          <div className="container-custom relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black uppercase text-white tracking-wider">Kết quả khách hàng</h2>
              <p className="text-lg text-slate-400 mt-4">
                Những học viên đã tin tưởng và lột xác cùng <span className="text-primary font-bold">{trainer.name}</span>
              </p>
            </div>

            {/* Grid 3 cột */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => (
                <CustomerCard key={story._id} story={story} />
              ))}
            </div>
            
            {/* Link xem tất cả */}
            <div className="text-center mt-12">
              <Link 
                to="/ket-qua-khach-hang" 
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-primary text-white font-bold hover:bg-primary transition-colors uppercase tracking-widest"
              >
                Xem tất cả câu chuyện <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =============================================
          4. HỎI ĐÁP (FAQ)
          ============================================= */}
      {trainer.faqs?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container-custom max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black uppercase text-slate-900">Câu hỏi thường gặp</h2>
              <p className="text-lg text-slate-500 mt-4 font-medium">Bạn vẫn còn thắc mắc? Dưới đây là những câu hỏi phổ biến nhất.</p>
            </div>
            
            <div className="space-y-2">
              {trainer.faqs.map((faq, index) => (
                <AccordionItem 
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaqIndex === index}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? -1 : index)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  );
};

export default TrainerProfile;
