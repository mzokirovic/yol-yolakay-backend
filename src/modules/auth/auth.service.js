/**
 * ✅ SEND OTP
 * Professional yechim: Test raqamlari uchun provayder xatolarini bypass qiladi.
 */
async function sendOtp(phoneInput) {
    if (typeof phoneInput !== 'string') throw badRequest("Telefon raqam string bo'lishi kerak");

    let phone = phoneInput.replace(/[^\d]/g, '');
    const finalPhone = `+${phone}`;

    console.log(`📡 OTP so'rovi: ${finalPhone}`);

    // Supabase orqali OTP yuborishga urinish
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
        phone: finalPhone,
    });

    if (error) {
        // 🛡️ PROFESSIONAL FILTR:
        // Agar raqam test ro'yxatida bo'lsa va xato faqat SMS provayderdan bo'lsa
        const isTestPhone = finalPhone === '+998975387877' || finalPhone === '+19999999999';
        const isProviderError = error.message.toLowerCase().includes('provider') ||
                                error.message.toLowerCase().includes('twilio');

        if (isTestPhone && isProviderError) {
            console.warn("⚠️ SMS provayder xatosi test raqami uchun e'tiborsiz qoldirildi.");
            return { success: true, message: "OTP sent (Test Mode)" };
        }

        // Agar haqiqiy xato bo'lsa, uni logga yozamiz va qaytaramiz
        console.error("🔥 Supabase OTP Error:", error.message);
        throw error;
    }

    console.log("✅ OTP yuborildi.");
    return { success: true, message: "OTP sent" };
}