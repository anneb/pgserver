function niceNumbers (range, round) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      niceFraction = Math.ceil(fraction);
    }
    return niceFraction * Math.pow(10, exponent);
}

function getClassTicks (min, max, maxTicks) {
    const range = niceNumbers(max - min, false);
    let decimals = 0;
    let tickSpacing;
    if (range === 0) {
        tickSpacing = 1;
    } else {
        tickSpacing = range / maxTicks;
        let exponent = Math.floor(Math.log10(tickSpacing));
        tickSpacing = (Math.ceil(100 * (tickSpacing / Math.pow(10, exponent))) / 100) * Math.pow(10, exponent);        
        if (exponent < 2) {
            decimals = 2 - exponent;            
        }
    }
    return {
        min: Math.floor(min / tickSpacing) * tickSpacing,
        max: Math.ceil(max / tickSpacing) * tickSpacing,
        tickWidth: tickSpacing,
        decimals: decimals
    };
}
