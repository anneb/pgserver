function roundToPrecision(number, precision, direction) {
    let negative = (number < 0);
    if (negative) {
        number = -number;
        direction = -direction;
    }
    let roundFunc = (direction < 0 ? Math.floor : direction === 0 ? Math.round : Math.ceil);
    let exponent = Math.floor(Math.log10(number));
    let decimals = (exponent < precision)? precision - exponent : 0;
    let fraction = number / Math.pow(10,exponent);
    return Number((Math.pow(10, exponent) * roundFunc(fraction * Math.pow(10, precision)) / Math.pow(10, precision) * (negative ? -1 : 1)).toFixed(decimals));
}

function getIntervalClassTicks (min, max, classCount) {
    let niceMin = roundToPrecision(min, 2, -1);
    let niceMax = roundToPrecision(max, 2, 1);
    let interval = (niceMax - niceMin) / classCount;
    let result = [];
    for (let i = 0; i < classCount; i++) {
        result.push(roundToPrecision(niceMin + i * interval, 2, -1))
    }
    return {
        min: niceMin,
        max: niceMax,
        classes: result
    };
}
