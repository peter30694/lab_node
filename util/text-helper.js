// Function to fix Vietnamese text encoding when saving to database
function fixVietnameseTextForDB(text) {
    if (!text) return '';
    
    // Convert to string if it's not already
    let fixedText = String(text);
    
    // Ensure proper UTF-8 encoding for Vietnamese characters
    try {
        // Decode any potential encoding issues
        fixedText = decodeURIComponent(escape(fixedText));
    } catch (e) {
        // If decode fails, keep original text
        console.warn('Could not decode text:', e.message);
    }
    
    // Fix common encoding issues that might occur during form submission
    const encodingFixes = {
        // Fix common garbled Vietnamese characters
        '£n': 'ản',
        '©m': 'ẩm', 
        'ìæ€': 'ịnh',
        't¯m': 'tắm',
        'Út': 'ột',
        '£': 'ả',
        '©': 'ẩ',
        'ì': 'ị',
        'æ': 'ệ',
        '€': 'h',
        '¯': 'ắ',
        'Ú': 'ộ'
    };
    
    // Apply fixes
    Object.keys(encodingFixes).forEach(wrong => {
        fixedText = fixedText.replace(new RegExp(wrong, 'g'), encodingFixes[wrong]);
    });
    
    // Additional fixes for common patterns
    fixedText = fixedText
        .replace(/S £n ph ©m không xác ìæ€/g, 'Sản phẩm không xác định')
        .replace(/Cát t¯m cho chu Út/g, 'Cát tắm cho chuột')
        .replace(/Thức £n cho chó/g, 'Thức ăn cho chó')
        .replace(/Vòng c cho mèo/g, 'Vòng cổ cho mèo')
        .replace(/ chơi cho thú cưng/g, 'Đồ chơi cho thú cưng')
        .replace(/Sữa t¯m cho chó mèo/g, 'Sữa tắm cho chó mèo')
        .replace(/Bàn chải £nh răng/g, 'Bàn chải đánh răng')
        .replace(/Lồng nuôi chim/g, 'Lồng nuôi chim')
        // Fix remaining individual characters
        .replace(/£nh/g, 'ánh')
        .replace(/£n/g, 'ăn')
        // Additional character fixes
        .replace(/ ản /g, 'ản ')
        .replace(/ ẩm /g, 'ẩm ')
        .replace(/ ịnh/g, 'ịnh')
        .replace(/ ột/g, 'ột')
        .replace(/ ắm/g, 'ắm')
        .replace(/ ảnh/g, 'ánh')
        // Fix missing spaces
        .replace(/Sản phẩm không xácịnh/g, 'Sản phẩm không xác định')
        .replace(/Thứcản cho chó/g, 'Thức ăn cho chó')
        .replace(/Bàn chảiánh răng/g, 'Bàn chải đánh răng');
    
    return fixedText;
}

// Chuyển số thành chữ tiếng Việt (đơn giản, cho hóa đơn)
function convertNumberToWords(number) {
    if (typeof number !== 'number' || isNaN(number)) return '';
    const ones = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];
    if (number === 0) return 'không đồng';
    let str = '';
    let unitIdx = 0;
    let n = Math.floor(number);
    while (n > 0) {
        let part = n % 1000;
        if (part > 0) {
            let partStr = '';
            let hundreds = Math.floor(part / 100);
            let tens = Math.floor((part % 100) / 10);
            let onesDigit = part % 10;
            if (hundreds > 0) partStr += ones[hundreds] + ' trăm ';
            if (tens > 1) partStr += ones[tens] + ' mươi ';
            else if (tens === 1) partStr += 'mười ';
            else if (hundreds > 0 && onesDigit > 0) partStr += 'lẻ ';
            if (onesDigit > 0) {
                if (tens > 1 && onesDigit === 1) partStr += 'mốt ';
                else if (tens >= 1 && onesDigit === 5) partStr += 'lăm ';
                else partStr += ones[onesDigit] + ' ';
            }
            str = partStr + units[unitIdx] + ' ' + str;
        }
        n = Math.floor(n / 1000);
        unitIdx++;
    }
    str = str.trim() + ' đồng';
    str = str.charAt(0).toUpperCase() + str.slice(1);
    return str;
}

module.exports = {
    fixVietnameseTextForDB,
    convertNumberToWords
}; 