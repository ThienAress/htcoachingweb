import { describe, expect, it } from "vitest";

import {
  containsHealthInformation,
  containsPersonalHealthData,
} from "../personalHealthData.js";

describe("personal health language boundary", () => {
  it.each([
    "Lịch thi đấu Real Madrid",
    "lich thi dau Real Madrid",
  ])("does not interpret a sports fixture as pain: %s", (query) => {
    expect({
      containsHealth: containsHealthInformation(query),
      containsPersonalHealth: containsPersonalHealthData(query),
    }).toEqual({
      containsHealth: false,
      containsPersonalHealth: false,
    });
  });

  it("continues to detect an actual personal pain disclosure", () => {
    expect(containsPersonalHealthData("Tôi bị đau đầu gối sau khi tập")).toBe(true);
  });

  it("detects a named person's lupus disclosure in source-like metadata", () => {
    expect(containsPersonalHealthData("Nguyen Van A has lupus")).toBe(true);
  });

  it("detects a lowercase named person's diagnosis disclosure", () => {
    expect(
      containsPersonalHealthData("zoraqx quux was diagnosed with lupus"),
    ).toBe(true);
  });

  it("detects a private diagnosis after public context", () => {
    expect(
      containsPersonalHealthData(
        "Ronaldo trains. zoraqx quux was diagnosed with lupus",
      ),
    ).toBe(true);
  });

  it.each([
    "Ronaldo says zoraqx quux who has lupus",
    "Ronaldo trains with zoraqx quux that has lupus",
  ])("detects a private health subject in a relative clause: %s", (value) => {
    expect(containsPersonalHealthData(value)).toBe(true);
  });

  it.each([
    "khách hàng mai đang dùng metformin",
    "học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
    "học viên Lan được kê Ozempic, nên tập cardio thế nào?",
    "client Jane uses warfarin and wants a workout",
    "client Jane is on warfarin and wants a workout",
    "client Jane was given lithium and wants exercise advice",
    "khách hàng An đang tiêm semaglutide, tìm nghiên cứu mới nhất",
    "client jane is receiving chemotherapy",
    "học viên nam HbA1c 9%",
    "học viên An có VO2max 28 ml/kg/min",
    "học viên Lan: VO2max 28 ml/kg/min, nên tập gì?",
    "khách hàng An có creatinine 2.1 mg/dL",
    "kết quả creatinine của khách hàng An là 2.1 mg/dL",
    "client Jane has SpO2 88% and wants cardio advice",
    "SpO2 của client Jane là 88%, latest research nói gì?",
    "BMI của tôi là 31",
    "my cholesterol is 280",
    "doctor prescribed me warfarin",
    "bác sĩ kê Ozempic cho tôi",
    "tôi được bác sĩ kê Ozempic",
    "Tôi bị sốt 39 độ sau khi tập",
    "I have a fever after training",
    "Tôi sốt 39 độ sau khi tập cardio",
    "My A1C is high after training",
    "Mình đang xài Ozempic",
    "I am diabetic and need a workout",
    "My kid has fever and needs a workout",
    "Con tôi sốt sau giờ học và cần bài tập nhẹ",
    "My mother is having a heart attack",
    "Tôi đang co giật",
    "I feel dizzy and am about to faint",
    "I do not want to live anymore",
    "I plan to overdose tonight",
    "Liều warfarin của tôi là 5mg",
    "I am on Ozempic and need exercise advice",
    "I have chest pain after squat and want swimming stroke tips",
    "Tôi bị PCOS và muốn có lịch tập phù hợp",
    "I have PCOS and need exercise advice",
    "Tôi được chẩn đoán PCOS và cần lịch tập",
    "Tôi bị buồng trứng đa nang và cần lịch tập",
    "Tôi bị đa nang buồng trứng và cần lịch tập",
    "I have polycystic ovarian syndrome and need exercise advice",
    "Tôi có câu hỏi: tôi bị PCOS thì tập gì?",
    "my friend bob who tore his ACL",
    "my son who is autistic",
    "my kid with covid",
    "I have migraine",
    "I take prednisone",
    "client Bob has epilepsy",
    "Tôi sinh ngày 01/02/1990 và muốn có lịch tập phù hợp",
    "Ngày sinh của tôi là 01/02/1990",
    "Ngày sinh của tôi: 01/02/1990",
    "DOB: 01/02/1990",
    "My date of birth is 1990-02-01",
    "Date of birth: 1990-02-01",
    "Tôi sinh vào ngày 01/02/1990",
    "Ngày sinh của khách hàng Lan là 01/02/1990",
    "Cầu thủ Cristiano Ronaldo DOB 1985-02-05",
    "bob was born on 1990-01-01",
    "Ronaldo was born on 1985-02-05 and bob was born on 1990-01-01",
    "I have multiple sclerosis, latest exercise advice",
    "I have eczema, what is the latest workout guidance?",
    "I take levothyroxine, current exercise recommendations",
    "my friend has lupus, latest fitness advice",
    "I have Crohn disease, latest exercise research",
    "My doctor put me on levothyroxine, latest exercise advice",
    "I am allergic to latex, latest workout advice",
    "I have narcolepsy, what changed recently?",
    "My friend has Hashimotos, what changed recently?",
    "I am on methotrexate, latest research?",
    "I'm on methotrexate, latest research?",
    "My friend is on methotrexate, latest research?",
  ])("detects private medication, treatment, and biomarker records: %s", (query) => {
    expect(containsPersonalHealthData(query)).toBe(true);
  });

  it("does not turn an informational health question into a personal record", () => {
    expect(containsPersonalHealthData("Tôi muốn hỏi bệnh tiểu đường là gì?")).toBe(false);
  });

  it.each([
    "Tôi có dầu olive để nấu ăn",
    "Tôi có đầu óc sáng tạo",
    "Tôi có bệnh viện gần nhà",
  ])("does not interpret a Vietnamese homograph as health information: %s", (query) => {
    expect({
      containsHealth: containsHealthInformation(query),
      containsPersonalHealth: containsPersonalHealthData(query),
    }).toEqual({
      containsHealth: false,
      containsPersonalHealth: false,
    });
  });

  it.each([
    "học viên Lan dùng máy chạy bộ 20 phút",
    "học viên Lan dùng một máy chạy bộ 20 phút",
    "học viên Lan sử dụng chiếc máy chạy bộ",
    "client Jane uses resistance bands for 12 reps",
    "client Jane uses a resistance band for 12 reps",
    "client Jane uses the treadmill for cardio",
    "client Jane is using a workout app",
    "client Jane uses a new training program",
    "học viên An có 3 buổi tập mỗi tuần",
    "client Jane has set3 10 reps",
    "học viên Lan tập RPE8 với 100kg",
    "client Jane trains at RIR2 for 10 reps",
    "tôi deadlift 100kg ở RPE8",
    "Tôi dùng đai lưng khi squat",
    "Tôi dùng mức tạ 100kg khi squat",
    "Tôi dùng straps khi deadlift",
    "Tôi dùng thanh đòn 20kg",
    "Tôi sử dụng tempo 3-1-1 khi tập",
    "I use a belt for squats",
    "I use lifting straps for deadlifts",
    "Tôi dùng Google để tìm bài squat",
    "Tôi dùng Strava để theo dõi buổi tập",
    "Tôi dùng pre-workout trước khi tập",
    "Why is diabetes common in my country?",
    "Do kids often get a fever?",
    "Trẻ em bị sốt có phổ biến không?",
    "PCOS là gì?",
    "Hội chứng buồng trứng đa nang ảnh hưởng việc tập luyện thế nào?",
    "Tôi có câu hỏi: PCOS là gì?",
    "Tôi có thắc mắc về PCOS",
    "What is an ACL tear?",
    "What does autistic mean?",
    "What is COVID?",
    "What is migraine?",
    "What is prednisone used for?",
    "What is epilepsy?",
    "Lịch tập ngày 01/02/2027: squat 3 hiệp x 10 reps với 80kg",
    "Lịch thi đấu ngày 01/02/2027 của Real Madrid",
    "Squat 4 sets x 8 reps at 80kg on 2027-02-01",
    "I have dumbbells and need a workout",
    "I have time for a workout",
    "I have a question about squat",
    "I take creatine before training",
    "My friend has a home gym",
    "I take a walk after lunch",
    "I am on vacation and want a workout",
    "I'm on a bus and reading about fitness",
    "My friend is on the train to the gym",
    "I have a dog and enjoy walking",
    "I have a phone and a computer",
    "Cristiano Ronaldo has a new workout",
  ])("does not mistake ordinary training structure for a clinical record: %s", (query) => {
    expect(containsPersonalHealthData(query)).toBe(false);
  });
});
