import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CustomerStory from './src/models/CustomerStory.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/htcoaching";

const stories = [
  {
    slug: "vy-ngo-27-tuoi-3-thang",
    name: "Vy Ngô",
    age: "27",
    job: "Nhân viên văn phòng",
    result: "Giảm mỡ, siết cơ",
    duration: "3 Tháng",
    packageName: "1 Kèm 1 Offline",
    goal: "Giảm mỡ bụng, săn chắc toàn thân",
    startWeight: "58kg",
    endWeight: "52kg",
    beforeImg: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=400&h=500&auto=format&fit=crop",
    afterImg: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=400&h=500&auto=format&fit=crop",
    heroImage: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=1200&h=800&auto=format&fit=crop",
    status: "published",
    featured: true,
    publishedAt: new Date(),
  },
  {
    slug: "ngoc-chau-30-tuoi-11-tuan",
    name: "Ngọc Châu",
    age: "30",
    job: "Kinh doanh tự do",
    result: "Tăng cơ, cải thiện thể lực",
    duration: "11 Tuần",
    packageName: "1 Kèm 1 Online",
    goal: "Tăng vòng 3, cải thiện sức bền",
    startWeight: "45kg",
    endWeight: "49kg",
    beforeImg: "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=400&h=500&auto=format&fit=crop",
    afterImg: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&h=500&auto=format&fit=crop",
    heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&h=800&auto=format&fit=crop",
    status: "published",
    featured: false,
    publishedAt: new Date(),
  },
  {
    slug: "quynh-trang-25-tuoi-16-tuan",
    name: "Quỳnh Trang",
    age: "25",
    job: "Sinh viên",
    result: "Giảm cân ngoạn mục",
    duration: "16 Tuần",
    packageName: "Online Coaching",
    goal: "Giảm béo phì, cải thiện sức khỏe",
    startWeight: "75kg",
    endWeight: "60kg",
    beforeImg: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=400&h=500&auto=format&fit=crop",
    afterImg: "https://images.unsplash.com/photo-1548690312-e3b507d8c110?q=80&w=400&h=500&auto=format&fit=crop",
    heroImage: "https://images.unsplash.com/photo-1548690312-e3b507d8c110?q=80&w=1200&h=800&auto=format&fit=crop",
    status: "published",
    featured: true,
    publishedAt: new Date(),
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    
    // Clear existing for testing
    // await CustomerStory.deleteMany({ slug: { $in: stories.map(s => s.slug) } });

    for (const story of stories) {
      await CustomerStory.findOneAndUpdate(
        { slug: story.slug },
        story,
        { upsert: true, new: true }
      );
    }
    
    console.log("Successfully seeded 3 customer stories!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding:", err);
    process.exit(1);
  }
}

seed();
