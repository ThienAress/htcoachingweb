import Gym from "../models/Gym.js";

// GET /api/gyms — Public: lấy danh sách phòng tập active
export const getGyms = async (req, res) => {
  try {
    const { district, search } = req.query;
    let query = { status: "active" };
    if (district) query.district = district;
    if (search) query.name = { $regex: search, $options: "i" };

    const gyms = await Gym.find(query).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: gyms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/gyms/all — Admin: lấy tất cả (kể cả inactive)
export const getAllGyms = async (req, res) => {
  try {
    const gyms = await Gym.find().sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: gyms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/gyms/districts — Public: lấy danh sách quận
export const getDistricts = async (req, res) => {
  try {
    const districts = await Gym.distinct("district", { status: "active" });
    res.json({ success: true, data: districts.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/gyms — Admin: tạo phòng tập
export const createGym = async (req, res) => {
  try {
    const { name, address, district, openingHours, googleMapsUrl, note, hasKickfit, status, sortOrder } = req.body;
    if (!name || !address || !district) {
      return res.status(400).json({ success: false, message: "Thiếu tên, địa chỉ hoặc quận" });
    }
    const image = req.file ? req.file.path : "";
    const gym = await Gym.create({
      name, address, district, image, openingHours, googleMapsUrl, note,
      hasKickfit: hasKickfit === "true" || hasKickfit === true,
      status: status || "active",
      sortOrder: parseInt(sortOrder) || 0,
    });
    res.status(201).json({ success: true, data: gym });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/gyms/:id — Admin: cập nhật phòng tập
export const updateGym = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) updates.image = req.file.path;
    if (updates.hasKickfit !== undefined) {
      updates.hasKickfit = updates.hasKickfit === "true" || updates.hasKickfit === true;
    }
    if (updates.sortOrder !== undefined) {
      updates.sortOrder = parseInt(updates.sortOrder) || 0;
    }
    const gym = await Gym.findByIdAndUpdate(req.params.id, updates, { returnDocument: "after" });
    if (!gym) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, data: gym });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/gyms/:id — Admin: xóa phòng tập
export const deleteGym = async (req, res) => {
  try {
    const gym = await Gym.findByIdAndDelete(req.params.id);
    if (!gym) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, message: "Đã xóa" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/gyms/seed — Admin: seed 33 chi nhánh Waystation
export const seedGyms = async (req, res) => {
  try {
    const count = await Gym.countDocuments();
    if (count > 0) {
      return res.status(400).json({ success: false, message: `Đã có ${count} phòng tập. Xóa hết trước khi seed.` });
    }

    const kickfitBranches = ["Hoàng Văn Thụ", "Dân Chủ", "Lê Lợi", "Nguyễn Quý Anh", "Bạch Đằng", "An Dương Vương", "Huỳnh Tấn Phát"];

    const gymsData = [
      // Quận 6
      { name: "WAYSTATION AN DƯƠNG VƯƠNG", address: "395 An Dương Vương, Phường 10, Quận 6, TP.HCM", district: "Quận 6", openingHours: "24/24" },
      // Quận 7
      { name: "WAYSTATION HUỲNH TẤN PHÁT", address: "976 Huỳnh Tấn Phát, Phường Tân Phú, Quận 7, TP.HCM", district: "Quận 7", openingHours: "6:00 - 24:00" },
      { name: "WAYSTATION ĐƯỜNG 25", address: "69 Đường 25, Quận 7, TP.HCM", district: "Quận 7", openingHours: "24/24" },
      // Quận 8
      { name: "WAYSTATION PHẠM HÙNG", address: "C3/3 Phạm Hùng, Quận 8, TP.HCM", district: "Quận 8", openingHours: "24/24" },
      // Quận 9
      { name: "WAYSTATION TRẦN THỊ ĐIỆU", address: "51 Trần Thị Điệu, Phường Phước Long B, Quận 9, TP.HCM", district: "Quận 9", openingHours: "6:00 - 22:00" },
      { name: "WAYSTATION MAN THIỆN", address: "184 Man Thiện, Phường Tăng Nhơn Phú A, Quận 9, TP.HCM", district: "Quận 9", openingHours: "Sắp khai trương" },
      { name: "WAYSTATION TRƯƠNG VĂN HẢI", address: "6 Trương Văn Hải, Phường Tăng Nhơn Phú B, Quận 9, TP.HCM", district: "Quận 9", openingHours: "24/24" },
      // Quận 10
      { name: "WAYSTATION ĐỒNG NAI", address: "58 Đồng Nai, Phường 15, Quận 10, TP.HCM", district: "Quận 10", openingHours: "24/24" },
      // Quận 11
      { name: "WAYSTATION CƯ XÁ LỮ GIA", address: "15 Đường số 2, Cư Xá Lữ Gia, Phường 15, Quận 11, TP.HCM", district: "Quận 11", openingHours: "6:00 - 22:00" },
      // Quận 12
      { name: "WAYSTATION HIỆP THÀNH 23", address: "12 Hiệp Thành 23, Phường Hiệp Thành, Quận 12, TP.HCM", district: "Quận 12", openingHours: "6:00 - 22:00" },
      { name: "WAYSTATION ĐÔNG HƯNG THUẬN", address: "121B Đông Hưng Thuận 2, Phường Tân Hưng Thuận, Quận 12, TP.HCM", district: "Quận 12", openingHours: "6:00 - 22:00" },
      { name: "WAYSTATION TÔ KÝ", address: "346 Tô Ký, Phường Tân Chánh Hiệp, Quận 12, TP.HCM", district: "Quận 12", openingHours: "24/24" },
      { name: "WAYSTATION NGUYỄN THỊ KIÊU", address: "111 Nguyễn Thị Kiêu, Phường Thới An, Quận 12, TP.HCM", district: "Quận 12", openingHours: "6:00 - 22:00" },
      // Tân Bình
      { name: "WAYSTATION ĐÔNG HỒ", address: "45B Đông Hồ, Phường 8, Tân Bình, TP.HCM", district: "Tân Bình", openingHours: "6:00 - 22:00" },
      { name: "WAYSTATION THÁI THỊ NHẠN", address: "1 Thái Thị Nhạn, Phường 10, Tân Bình, TP.HCM", district: "Tân Bình", openingHours: "24/24" },
      // Tân Phú
      { name: "WAYSTATION KÊNH TÂN HÓA", address: "58 Kênh Tân Hóa, Phường Phú Trung, Tân Phú, TP.HCM", district: "Tân Phú", openingHours: "6:00 - 24:00" },
      { name: "WAYSTATION NGUYỄN QUÝ ANH", address: "86 Nguyễn Quý Anh, Phường Tân Sơn Nhì, Tân Phú, TP.HCM", district: "Tân Phú", openingHours: "24/24" },
      // Gò Vấp
      { name: "WAYSTATION QUANG TRUNG", address: "770 Quang Trung, Phường 8, Gò Vấp, TP.HCM", district: "Gò Vấp", openingHours: "24/24" },
      { name: "WAYSTATION DƯƠNG QUẢNG HÀM", address: "262 Dương Quảng Hàm, Phường 5, Gò Vấp, TP.HCM", district: "Gò Vấp", openingHours: "24/24" },
      { name: "WAYSTATION LÊ LỢI", address: "66 Lê Lợi, Phường 4, Gò Vấp, TP.HCM", district: "Gò Vấp", openingHours: "24/24" },
      { name: "WAYSTATION LÊ ĐỨC THỌ", address: "1468 Lê Đức Thọ, Phường 13, Gò Vấp, TP.HCM", district: "Gò Vấp", openingHours: "24/24" },
      { name: "WAYSTATION NGUYỄN VĂN LƯỢNG", address: "70 Nguyễn Văn Lượng, Phường 10, Gò Vấp, TP.HCM", district: "Gò Vấp", openingHours: "24/24" },
      // Phú Nhuận
      { name: "WAYSTATION TRƯƠNG QUỐC DUNG", address: "9 Trương Quốc Dung, Phú Nhuận, TP.HCM", district: "Phú Nhuận", openingHours: "24/24" },
      { name: "WAYSTATION ĐÀO DUY ANH", address: "15 Đào Duy Anh, Phường 9, Phú Nhuận, TP.HCM", district: "Phú Nhuận", openingHours: "6:00 - 24:00" },
      // Bình Thạnh
      { name: "WAYSTATION NGUYỄN XÍ", address: "181 Nguyễn Xí, Phường 26, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "24/24" },
      { name: "WAYSTATION BẠCH ĐẰNG", address: "256 Bạch Đằng, Phường 24, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "24/24" },
      { name: "WAYSTATION HOÀNG HOA THÁM", address: "64 Hoàng Hoa Thám, Phường 7, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "24/24" },
      { name: "WAYSTATION UNG VĂN KHIÊM 2", address: "165 Ung Văn Khiêm, Phường 25, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "24/24" },
      { name: "WAYSTATION PHAN HUY ÔN", address: "9 Phan Huy Ôn, Phường 19, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "24/24" },
      { name: "WAYSTATION UNG VĂN KHIÊM 1", address: "123 Ung Văn Khiêm, Phường 25, Bình Thạnh, TP.HCM", district: "Bình Thạnh", openingHours: "6:00 - 22:00" },
      // Thủ Đức
      { name: "WAYSTATION DÂN CHỦ", address: "56F Dân Chủ, Phường Bình Thọ, Thủ Đức, TP.HCM", district: "Thủ Đức", openingHours: "24/24" },
      { name: "WAYSTATION HIỆP BÌNH", address: "135 Hiệp Bình, Phường Hiệp Bình Chánh, Thủ Đức, TP.HCM", district: "Thủ Đức", openingHours: "24/24" },
      { name: "WAYSTATION QUỐC LỘ 13", address: "361 Quốc Lộ 13, Phường Hiệp Bình Phước, Thủ Đức, TP.HCM", district: "Thủ Đức", openingHours: "6:00 - 22:00" },
    ];

    // Gán hasKickfit + googleMapsUrl
    const prepared = gymsData.map((g, idx) => {
      const shortName = g.name.replace("WAYSTATION ", "");
      const isKickfit = kickfitBranches.some(k => shortName.includes(k));
      return {
        ...g,
        hasKickfit: isKickfit,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.address)}`,
        sortOrder: idx,
      };
    });

    const result = await Gym.insertMany(prepared);
    res.status(201).json({ success: true, message: `Seed thành công ${result.length} phòng tập`, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
