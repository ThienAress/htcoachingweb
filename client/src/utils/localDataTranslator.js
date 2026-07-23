const specialtyMap = {
  "Huấn luyện 1-1 (Online/Offline)": "1-on-1 PT Coaching (Online/Offline)",
  "Huấn luyện 1-1": "1-on-1 PT Coaching",
  "Meal plan cá nhân hóa": "Personalized Meal Plan",
  "Theo dõi tiến độ định kỳ": "Regular Progress Tracking",
  "Hỗ trợ phục hồi": "Recovery Support",
};

const jobMap = {
  "Nhân viên y tế": "Medical Staff",
  "Công ty tổ chức sự kiện": "Event Planning Staff",
  "Công ty xây dựng": "Construction Staff",
  "Nhân viên kĩ thuật": "Technical Technician",
  "Nhân viên ngân hàng": "Bank Officer",
  "Doanh nghiệp EMA TECH": "EMA TECH Business Owner",
  "Nhân viên logistics": "Logistics Specialist",
  "Giáo viên mầm non": "Kindergarten Teacher",
};

const goalMap = {
  "Giảm mỡ, giảm cân, lấy lại vóc dáng": "Lose fat, lose weight, get in shape",
  "Giảm mỡ, giảm cân": "Lose fat & weight",
  "Tăng cân, tăng cơ": "Gain weight & muscle",
  "Giảm mỡ": "Lose fat",
  "Giảm mỡ, tăng size vòng 3": "Lose fat & tone glutes",
  "Giảm mỡ , giảm cân, lấy lại vóc dáng": "Lose fat, lose weight, get in shape",
};

const scheduleMap = {
  "T3 T5 T7": "Tue, Thu, Sat",
  "T2 T4 T6": "Mon, Wed, Fri",
  "T3 T4 T5 T6": "Tue, Wed, Thu, Fri",
  "T3 T6": "Tue, Fri",
};

const packageMap = {
  "Nâng Cao(1-1)": "Advanced (1-1)",
  "Cơ Bản(1-1)": "Basic (1-1)",
  "Vip(1-1)": "VIP (1-1)",
  "Nâng Cao (1-1)": "Advanced (1-1)",
  "Cơ Bản (1-1)": "Basic (1-1)",
  "Vip (1-1)": "VIP (1-1)",
};

const durationMap = {
  "39 tuần": "39 weeks",
  "3 tháng": "3 months",
  "90 ngày": "90 days",
  "1 tháng": "1 month",
};

const resultMap = {
  "50kg": "Down to 50kg",
  "54kg": "Down to 54kg",
  "68kg": "Up to 68kg",
  "69kg": "Up to 69kg",
};

const trainerTranslations = {
  "hoang-thien": {
    title: "Personal Training Specialist",
    experience: "4+ Years of Experience",
    bio: "I will help you build a healthy physique and improve your lifestyle through scientific, personalized training and optimized nutrition.",
    trainingStyle: "Passionate, disciplined, no compromise",
    headline: "Personal Training Expert | 4+ Years of Experience",
    motto: "No pain no gain",
    philosophy: "Go hard or go home",
    stats: [
      { label: "clients", value: "30+" },
      { label: "experience", value: "5+" },
    ],
    methodologies: [
      {
        title: "NUTRITION: Discipline at the table",
        description: "Nutrition is the core foundation, and here, I require precision instead of intuition. Your body cannot burn fat or build muscle efficiently with incorrect diet habits. Every macro metric will be calculated to the gram, closely matching your actual body fat and total daily energy expenditure. Our steel discipline is not just in the gym, it must start on your dining table.",
      },
      {
        title: "TRAINING: Pushing limits, science-based",
        description: "Sweat on the gym floor is the price to pay to not be disappointed when looking in the mirror. My method is to push you past your comfort zone, but strictly following a scientific and rigorous roadmap. No random Bench Press or Squatting. All limits will be shattered once you've built a perfect biomechanic movement foundation.",
      },
      {
        title: "RECOVERY: Regenerate to breakthrough",
        description: "Training is the process of breaking limits, but recovery is when the body actually regenerates and grows. Don't think that leaving the gym means your task is done. If you don't seriously prioritize recovery, your body will never reach the optimal state to ready yourself for the strict intensity of the next session.",
      },
    ],
    faqs: [
      {
        question: "Will female clients get too bulky if they lift heavy weights?",
        answer: "Absolutely NOT. Women's bodies do not have enough natural Testosterone to build massive bodybuilding-style muscles. Lifting weights at high intensity is the only way to break down stubborn fat, tone the body, and reveal defined curves. Bulking only happens when you train half-heartedly and eat undisciplined, leading to fat gain.",
      },
      {
        question: "How long does weight training take to see results?",
        answer: "Depends on your goals, usually 3-6 months depending on objectives and possibly longer for optimal conditioning. If you're looking for a shortcut or a promise like 'lose 10kg in 1 month', this is not the place for you. Time to see results depends 100% on your discipline in the gym and on the plate. Typically: 4 weeks to feel changes in stamina, 8 weeks for looser clothes, and 12 weeks for others to notice. Pre-requisite: No excuses.",
      },
      {
        question: "I only want to lose belly fat (or arms, thighs), is there any fast workout?",
        answer: "Hard truth: There is no spot reduction. Doing thousands of crunches only makes abdominal muscles stronger, it doesn't melt the fat layer on top. Fat is burned systemically once we establish a precise calorie deficit based on your TDEE. Flat abs are built in the kitchen, and tightness is forged on the gym floor.",
      },
      {
        question: "I am a complete beginner with very weak fitness, can I keep up with this intensity?",
        answer: "Intense doesn't mean exhausting you uncontrollably. For absolute beginners, you won't be pushed into Bench Presses or Squats blindly. The foundation phase focuses strictly on resetting core movement forms with bodyweight and dumbbells. You must master your body before thinking of lifting heavier loads.",
      },
      {
        question: "Can I have a 'Cheat day' on my rest days?",
        answer: "'Cheat day' is what destroys all the efforts of a whole week of training. Here, we only have 'Cheat meals' (a controlled free meal) to ease the mind, and it is only allowed when you have successfully completed 100% of your training and nutrition plans for that week.",
      },
    ],
  },
};

const storyTranslations = {
  "thanh-huyen": {
    job: "Medical Staff",
    goal: "Lose fat, lose weight, get in shape",
    packageName: "Advanced (1-1)",
    result: "Down to 50kg",
    duration: "39 weeks",
    schedule: "Tue, Thu, Sat",
    problem: "When she started training with me, Huyen was a medical student. Due to a very busy and heavy study schedule, she was stressed and gained weight/fat. She needed an effective workout solution to burn fat, lose weight and get in better shape.",
    solution: "Since Huyen had never worked out in a gym or played any other sport before, building a solid foundation was absolutely essential. I customized her schedule, nutrition, and training stage-by-stage.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize form, adapt to workouts and nutrition",
        content: "At this stage, we focused strictly on building basic movements. We avoided rushing to heavy weights to prevent injury.",
        bullets: [
          "Got used to healthier eating habits",
          "Learned how to execute basic foundation exercises properly",
          "Lost 3kg of body weight",
          "Improved cardiovascular endurance from cardio sessions",
        ],
      },
      {
        title: "Week 8-31",
        subtitle: "Advanced, entering the shape-recovery phase",
        content: "This was a long period where Huyen worked hard and ate properly to achieve the body shape we agreed on initially.",
        bullets: [
          "Lost an additional 5kg, reaching her target weight",
          "Reduced body fat percentage to a healthy range",
          "Mastered all workout forms and techniques",
          "Learned how to choose healthier foods independently",
          "Can now work out on her own without a personal trainer",
        ],
      },
    ],
  },
  "cao-luc": {
    job: "Event Planning Staff",
    goal: "Lose fat & weight",
    packageName: "Basic (1-1)",
    schedule: "Tue, Thu, Sat",
  },
  "thu-nhi-3-thang": {
    job: "Construction Staff",
    goal: "Lose fat & weight",
    packageName: "VIP (1-1)",
    result: "Down to 54kg",
    duration: "3 months",
    schedule: "Tue, Thu, Sat",
    problem: "Nhi was extremely busy with work, not paying attention to herself. One day she noticed her weight surged and fat accumulated, so she resolved to work out and regain her shape.",
    solution: "Since she had never played any sport before, starting was very difficult. I designed a customized schedule to keep her from getting overwhelmed and giving up.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize form, get used to a new sport",
        content: "As a beginner, her form and cardio stamina were weak. Building an adaptation foundation for resistance training was critical.",
      },
    ],
  },
  "hoang-nguyen-90-ngay": {
    job: "Technical Technician",
    goal: "Gain weight & muscle",
    packageName: "Advanced (1-1)",
    result: "Up to 68kg",
    duration: "90 days",
    schedule: "Tue, Thu, Sat",
    problem: "Nguyen was someone who had never worked out, and although he ate a lot, he couldn't gain weight. As a technician, his diet was irregular, so he wanted to improve both his physique and weight.",
    solution: "Understanding Nguyen's issue, besides the nutrition and training plans, I motivated him to eat more daily and avoid skipping meals.",
    milestones: [
      {
        title: "Week 1-6",
        subtitle: "Stabilize form, get used to eating and training plans",
        content: "Since Nguyen had never trained, starting with core basics was key. He stabilized form and ate scientifically to improve weight.",
      },
    ],
  },
  "huynh-thien-long": {
    job: "Bank Officer",
    goal: "Lose fat",
    packageName: "Basic (1-1)",
    schedule: "Tue, Wed, Thu, Fri",
  },
  "le-thanh-nhan-1-thang": {
    job: "EMA TECH Business Owner",
    goal: "Gain weight & muscle",
    packageName: "Basic (1-1)",
    result: "Up to 69kg",
    duration: "1 month",
    schedule: "Tue, Fri",
    problem: "Mr. Nhan runs a company and is very busy. His diet was irregular and health declined, so he resolved to train and eat properly.",
    solution: "Having never trained and consuming alcohol regularly due to work, I redesigned a scientific diet, modified lifestyle choices, and set up appropriate training stages.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize form, adapt to workouts",
        content: "In the first weeks, I got him accustomed to correct forms, which is key to executing safely and preventing injuries.",
      },
    ],
  },
  "thuy-van": {
    job: "Logistics Specialist",
    goal: "Lose fat & weight",
    packageName: "Basic (1-1)",
    problem: "I have been overweight for a long time, never trained with a personal trainer. Now as I get older, I'm determined to fit my shape to be healthy and beautiful. Lucky to train with Coach Thien, I hope we will achieve success together.",
    solution: "Since Van had never played sports before, building her foundation was the primary goal to reach her targets safely and effectively.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize training form",
        content: "Being a complete beginner, form stabilization was the top priority to safely burn fat and lose weight without injuries.",
      },
    ],
  },
  "tuyet-nhi": {
    job: "Logistics Specialist",
    goal: "Lose fat & tone glutes",
    packageName: "Basic (1-1)",
    problem: "I went to the gym before but couldn't stick to it long term. Now I want to return seriously and need a companion to help improve my physique and maintain a workout habit.\n\nWorking in an office, sitting all day makes me want to change my diet and lifestyle for more energy. My immediate goal is to lose fat in key areas and tone my body for my wedding in 2 months.\n\nI want to build a long-term healthy lifestyle to feel active, build muscle, burn fat, and confidently wear what I love.",
    solution: "Since Nhi had trained before, she only needed 2-3 weeks to regain good form, and I designed training and nutrition to help her reach her wedding goal quickly.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize training form",
        content: "Returning after a 1-year break, the first priority was stabilizing form and starting weight loss while targeting glute size.",
      },
    ],
  },
  "vy-ngo-3-thang": {
    job: "Kindergarten Teacher",
    goal: "Lose fat, lose weight, get in shape",
    packageName: "Advanced (1-1)",
    duration: "3 months",
    schedule: "Mon, Wed, Fri",
    problem: "Client wanted to lose fat and weight but didn't know where to start, lacking training and nutrition knowledge, hence needing a coach.",
    solution: "Since Vy had never worked out before, I designed personalized training and nutrition going from basic to advanced.",
    milestones: [
      {
        title: "Week 1-8",
        subtitle: "Stabilize training form",
        content: "Since she had never trained, form stabilization was the key foundation to achieve results safely and avoid injuries.",
      },
    ],
  },
};

export const translateItem = (item, type, currentLang = "en") => {
  if (currentLang !== "en" || !item) return item;

  const slug = item.slug;

  if (type === "trainer") {
    const defaultData = trainerTranslations[slug] || {};

    // 1. Dịch các specialties
    const localizedSpecialties = Array.isArray(item.specialties)
      ? item.specialties.map(spec => ({
          ...spec,
          label: specialtyMap[spec.label] || spec.label,
        }))
      : [];

    // 2. Dịch methodologies
    const localizedMethodologies = Array.isArray(item.methodologies)
      ? item.methodologies.map((method, idx) => {
          const defaultMethod = defaultData.methodologies?.[idx] || {};
          return {
            ...method,
            title: defaultMethod.title || method.title,
            description: defaultMethod.description || method.description,
          };
        })
      : [];

    // 3. Dịch faqs
    const localizedFaqs = Array.isArray(item.faqs)
      ? item.faqs.map((faq, idx) => {
          const defaultFaq = defaultData.faqs?.[idx] || {};
          return {
            ...faq,
            question: defaultFaq.question || faq.question,
            answer: defaultFaq.answer || faq.answer,
          };
        })
      : [];

    return {
      ...item,
      title: defaultData.title || item.title || "",
      experience: defaultData.experience || item.experience || "",
      bio: defaultData.bio || item.bio || "",
      trainingStyle: defaultData.trainingStyle || item.trainingStyle || "",
      headline: defaultData.headline || item.headline || "",
      motto: defaultData.motto || item.motto || "",
      philosophy: defaultData.philosophy || item.philosophy || "",
      stats: Array.isArray(item.stats)
        ? item.stats.map((stat, idx) => {
            const defaultStat = defaultData.stats?.[idx] || {};
            return {
              ...stat,
              label: defaultStat.label || stat.label,
            };
          })
        : [],
      specialties: localizedSpecialties,
      methodologies: localizedMethodologies,
      faqs: localizedFaqs,
    };
  }

  if (type === "story") {
    const defaultData = storyTranslations[slug] || {};

    // 1. Dịch các milestones
    const localizedMilestones = Array.isArray(item.milestones)
      ? item.milestones.map((milestone, idx) => {
          const defaultMilestone = defaultData.milestones?.[idx] || {};

          const localizedBullets = Array.isArray(milestone.bullets) && Array.isArray(defaultMilestone.bullets)
            ? milestone.bullets.map((bullet, bIdx) => defaultMilestone.bullets[bIdx] || bullet)
            : milestone.bullets;

          return {
            ...milestone,
            title: defaultMilestone.title || milestone.title,
            subtitle: defaultMilestone.subtitle || milestone.subtitle,
            content: defaultMilestone.content || milestone.content,
            bullets: localizedBullets,
          };
        })
      : [];

    return {
      ...item,
      job: defaultData.job || jobMap[item.job] || item.job || "",
      goal: defaultData.goal || goalMap[item.goal] || item.goal || "",
      packageName: defaultData.packageName || packageMap[item.packageName] || item.packageName || "",
      result: defaultData.result || resultMap[item.result] || item.result || "",
      duration: defaultData.duration || durationMap[item.duration] || item.duration || "",
      schedule: defaultData.schedule || scheduleMap[item.schedule] || item.schedule || "",
      problem: defaultData.problem || item.problem || "",
      solution: defaultData.solution || item.solution || "",
      milestones: localizedMilestones,
    };
  }

  if (type === "blog") {
    const defaultData = blogTranslations[slug] || {};
    return {
      ...item,
      title: defaultData.title || item.title || "",
      excerpt: defaultData.excerpt || item.excerpt || "",
      content: defaultData.content || item.content || "",
    };
  }

  if (type === "exercise") {
    const exerciseMuscleMap = {
      "Cơ bụng / Eo": "Abs / Waist",
      "Cơ đùi trước / Đùi sau": "Thighs / Hamstrings",
      "Cơ lưng": "Back",
      "Cơ bắp chân": "Calves",
      "Cơ ngực": "Chest",
      "Cơ tay trước / Tay sau": "Biceps / Triceps",
      "Cardio / Tim mạch": "Cardio / Cardiovascular",
      "Cơ vai": "Shoulders",
      "Cơ cẳng tay": "Forearms",
      "Chân": "Legs",
    };
    return {
      ...item,
      muscleGroup: exerciseMuscleMap[item.muscleGroup] || item.muscleGroup || "",
    };
  }

  return item;
};

const blogTranslations = {
  "ky-thuat-dumbbell-chest-press-chuan": {
    title: "Classic Chest Press Mistake: Barbell Bench Press Passion But... Rotator Cuff Tear",
    excerpt: "\"Monday is International Chest Day\" – Enter any gym in the world on Monday afternoon, and you'll find the Barbell Bench Press benches fully occupied. But what's the real cost?",
    content: `<p><strong>"Monday is International Chest Day"</strong>. Walk into any gym in the world on Monday afternoon, and you will find the Barbell Bench Press benches always "fully booked." For a long time, the weight on the bench press has become an invisible measure of strength among gym-goers.</p>
<p>However, behind those heavy weights lies a harsh truth: many people press but their chests do not grow, their triceps get exhausted, and they wake up the next morning with a sharp pain in their shoulder joints.</p>
<p>At HT Coaching, we explicitly point out: For clients without a fitness foundation (F1 Clients), choosing the Barbell Bench Press as the starting exercise is a high-risk gamble. The truly safe and many times more effective solution is the <strong>Dumbbell Chest Press</strong> (Dumbbell press).</p>
<h3>The Harsh Truth About Barbell Bench Press For Beginners</h3>
<p>Barbell Bench Press is a great exercise, but it requires biomechanical conditions that 90% of beginners do not possess.</p>
<p><strong>1. Fixed trajectory and the risk of Shoulder Impingement:</strong> The barbell is a rigid physical object. When you grab the barbell, your hands and wrists are locked in a straight line. It forces your shoulders, elbows, and wrists to move along the barbell's trajectory. If your tendon-muscle system is not flexible enough, or you don't know how to lock your shoulder blades (Scapula retraction), the barbell will create tearing pressure on the rotator cuff tendons, causing shoulder impingement syndrome.</p>
<p><strong>2. Dominance of Triceps and Anterior Deltoids:</strong> When beginners press a barbell, survival instinct makes the brain recruit every muscle group possible to push the weight away from the chest. The result is that the front shoulders and triceps (small muscle groups) work too hard, while the chest (target muscle group) stays "asleep."</p>
<p><strong>3. Danger of failure without a Spotter:</strong> Pressing a barbell alone without a spotter is a real hazard. There are many cases of lifters getting exhausted and pinned by the barbell on their neck or chest.</p>
<h3>Why Dumbbell Chest Press Is the "True Match" for Beginners?</h3>
<p>Based on the principles of the Stabilization phase (Phase 1) in the NASM OPT model, we always recommend clients use dumbbells in the first few months.</p>
<ul>
<li><strong>Free Biomechanical Trajectory:</strong> Unlike the barbell, dumbbells do not lock your hands. Your wrists, elbows, and shoulders are free to move in the natural path of your individual anatomy. Your shoulder joints can "breathe," completely eliminating impingement risks.</li>
<li><strong>Maximum Range of Motion (ROM):</strong> The barbell is stopped by your chest. But with dumbbells, you can lower them deeper (increasing stretch) and squeeze your hands closer at the top (increasing contraction). This is the key factor to activate hypertrophy.</li>
<li><strong>Fixes Muscle Imbalance:</strong> Most of us have one dominant side stronger than the other. The barbell allows the stronger side to carry the weaker side. Dumbbells force each side to handle an independent load, helping chest muscles develop evenly.</li>
<li><strong>Absolute Safety:</strong> If you fail, you just drop the weights to the sides. No risk of getting pinned.</li>
</ul>
<h3>Standard Setup Guide for Dumbbell Chest Press</h3>
<p>To optimize chest muscle activation and protect your shoulders, memorize these setup steps.</p>
<p><strong>Step 1: Safe Kick-up:</strong> Never pick up weights from the floor while lying down. Sit on the edge of the bench, place the dumbbells on your thighs (near knees). Take a deep breath, lie back while kicking your thighs up to bring the weights into the starting position.</p>
<p><strong>Step 2: Scapular Retraction & Depression:</strong> This is the secret separating a pro-lifter from a casual gym-goer.</p>
<ul>
<li>Lie on the bench and arch your upper chest.</li>
<li>Pinch your shoulder blades back (as if holding a pen between them).</li>
<li>Pull your shoulder blades down toward your glutes (Depression).</li>
<li>Keep this locked position glued to the bench throughout 100% of the set. This turns your chest into a stable platform and takes the shoulders out of the load.</li>
</ul>
<p><strong>Step 3: Golden Elbow Position (45-60 Degree Angle):</strong> Fatal mistake: flaring elbows out at a 90-degree angle (forming a T-shape). This will destroy your shoulder joints. Keep elbows tucked closer to the ribs, creating a 45 to 60-degree angle. This aligns with the chest fibers for maximum force and safety.</p>
<p><strong>Step 4: Tempo and Trajectory:</strong></p>
<ul>
<li><strong>Lowering (Eccentric):</strong> Inhale deeply into your belly. Slowly lower the weights over 2-3 seconds, feeling the chest stretch. Lower until dumbbells are near outer chest.</li>
<li><strong>Pressing (Concentric):</strong> Push through the heels of your hands, press up powerfully and exhale.</li>
<li><strong>Trajectory Note:</strong> The path is not a straight vertical line, but a slight curve, moving from lower/mid chest up toward chin/shoulder level.</li>
</ul>
<h3>FAQ - Frequently Asked Questions</h3>
<p><strong>1. Why do my arms shake when doing Dumbbell Press?</strong> This is normal for beginners. The stabilizer muscles around your shoulder joint are weak. Use lighter weights and focus on control; it will disappear after 2-3 weeks.</p>
<p><strong>2. Do I need to arch my back like Powerlifters?</strong> You need to arch your chest and lock your shoulder blades, which naturally creates a small arch in your lower back. You do NOT need an extreme arch unless you compete in powerlifting.</p>
<p><strong>3. How can I press heavier weights?</strong> Don't just press. Build nutrition by calculating Protein and Calories via the TDEE tool, and strengthen your back muscles to create a solid platform.</p>
<h3>Conclusion</h3>
<p>Don't let your ego destroy your shoulders. Switching to Dumbbell Chest Press is a smart strategic step to master mind-muscle connection and optimize chest growth. Be sure to check our Meal Plan section for proper nutrition fueling!</p>`
  },
  "ky-thuat-bodyweight-squat-cho-nguoi-moi": {
    title: "Standard Bodyweight Squat Technique for Beginners",
    excerpt: "The squat is considered the king of lower-body exercises, but we don't throw a barbell onto a beginner who cannot control their own body weight yet. Learn the foundations here.",
    content: `<p>Entering the gym, the sight of experienced lifters squatting heavy loads on their shoulders is always appealing. The common mentality of beginners is to copy them immediately, believing that heavier weights build muscle faster. But reality always answers with lower back pain, knee stiffness, and a collapsed form.</p>
<p>At HT Coaching, we consider the Squat the king of lower-body exercises, but we do not throw a barbell to someone who cannot control their own body weight yet. This article debunks harmful squat myths and guides you step-by-step through the <strong>Bodyweight Squat</strong> – the most solid foundation before you lift heavy.</p>
<h3>Why Barbell Squat Is a "Trap" for Beginners?</h3>
<p>In international training systems like the NASM OPT model, the first and most critical stage is always <strong>Stabilization</strong>. For F1 clients (no experience), skipping stabilization to jump straight into hypertrophy or strength with a barbell is the fastest path to injury.</p>
<p><strong>1. Huge Spinal Pressure without Core Strength:</strong> The barbell puts weight directly on your neck and spine. To protect your spine, your core (abs, lower back, pelvic floor) must act as a natural steel belt. Beginners have weak cores and don't know how to brace. The result? The weight crushes your lumbar discs, leading to herniation.</p>
<p><strong>2. Ankle and Hip Mobility Issues:</strong> Sedentary office lifestyles tighten hips and reduce ankle dorsiflexion. Squatting with stiff ankles prevents your knees from moving forward, forcing your hips too far back and collapsing your torso (Good Morning Squat).</p>
<p><strong>3. Lack of Motor Control:</strong> The squat is a compound movement requiring the brain to coordinate dozens of muscles. Beginners haven't formed this neural pathway. Adding weights only causes panic and joint compensation.</p>
<h3>Overhead Squat Assessment: The Mandatory Test</h3>
<p>At HT Coaching, we start with the <strong>Overhead Squat Assessment</strong> (using only bodyweight with arms raised high). This test reveals:</p>
<ul>
<li>Are your feet flattening or pronating?</li>
<li>Are your knees caving in (Valgus) due to weak glutes?</li>
<li>Is your lower back arching excessively (Anterior Pelvic Tilt)?</li>
</ul>
<p>Only when you pass this test or fix these dysfunctions with bodyweight squats can we transition to loaded squats.</p>
<h3>Perfecting the Bodyweight Squat Step-by-Step</h3>
<p>Never underestimate bodyweight. Performing 15 perfect reps with high focus will stimulate muscle growth incredibly well for beginners.</p>
<p><strong>Step 1: Foot Setup (The Tripod Foot):</strong></p>
<ul>
<li>Stance: Feet shoulder-width apart or slightly wider.</li>
<li>Angle: Point toes outward about 15-30 degrees for natural hip movement.</li>
<li>Tripod Foot: Press the heel, big toe base, and pinky toe base firmly into the floor like roots in the ground.</li>
</ul>
<p><strong>Step 2: Bracing - Protecting the Spine:</strong> Do not suck in your stomach! Inhale deeply through your nose, expanding your belly in all directions (front, back, sides). Then, brace your abs as if preparing to get punched. Maintain this pressure throughout the rep.</p>
<p><strong>Step 3: Lowering (Eccentric Phase):</strong></p>
<ul>
<li>Initiate by pushing hips back slightly (Hinge) and bending knees.</li>
<li>Imagine sitting down slowly into an invisible chair behind you.</li>
<li>Push knees out in the direction of your toes; do not let them cave in.</li>
<li>Depth: Lower until hip crease is below the top of knees (parallel or deeper). If your lower back rounds (Butt wink), stop at the deepest point you can maintain a neutral spine.</li>
</ul>
<p><strong>Step 4: Standing Up (Concentric Phase):</strong></p>
<ul>
<li>Drive through the mid-foot and heels to push straight up.</li>
<li>Engage glutes and quads to stand.</li>
<li>Exhale sharply through the mouth past the sticking point.</li>
<li>Squeeze glutes at the top without hyperextending the hips.</li>
</ul>
<h3>Progression: From Bodyweight to Goblet Squat</h3>
<p>Once you master bodyweight squats (3-4 sets of 15-20 perfect reps), move to the Goblet Squat (holding a dumbbell or kettlebell in front of your chest). This shifts the load forward, forcing your core to engage and helping you sit deeper with an upright torso before moving to the barbell.</p>
<h3>FAQ - Frequently Asked Questions</h3>
<p><strong>1. Can knees go past toes in a squat?</strong> Absolutely YES. The "knees not past toes" rule is a myth. Depending on femur length, knees passing toes is natural for balance. As long as heels stay flat, let knees move naturally.</p>
<p><strong>2. Why does my lower back hurt during squats?</strong> Usually due to weak bracing or deep squatting causing a butt wink (lumbar rounding). Go back to mastering bodyweight squats.</p>
<p><strong>3. Will squats make my thighs too bulky?</strong> For females, bulkiness requires a massive calorie surplus and heavy lifting for years. Bodyweight and Goblet squats mainly tone muscles and lift the glutes.</p>
<h3>Conclusion</h3>
<p>Squatting is a skill to be honed. Be patient and start from the basics. Combine workouts with proper calories calculated via our TDEE tool and custom meal plans!</p>`
  }
};

export const translateData = (data, type, currentLang = "en") => {
  if (currentLang !== "en" || !data) return data;

  if (Array.isArray(data)) {
    return data.map(item => translateItem(item, type, currentLang));
  }
  return translateItem(data, type, currentLang);
};
