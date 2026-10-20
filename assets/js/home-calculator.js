/* Budget and resale calculator (homepage). Plain math on the visitor's own numbers.
   Starting values are labeled examples, not market data or a quote. */
(function () {
  "use strict";
  var root = document.getElementById("budget-calculator");
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var ids = ["fc-price", "fc-sf", "fc-cps", "fc-soft", "fc-arv", "fc-months", "fc-rate", "fc-ltv", "fc-sell"];
  function g(id) { var x = parseFloat(String($(id).value).replace(/[$,%\s]/g, "")); return isFinite(x) ? x : 0; }
  function calc() {
    var price = g("fc-price"), cps = g("fc-cps"), sf = g("fc-sf"), arv = g("fc-arv"), months = g("fc-months"),
      rate = g("fc-rate") / 100, ltv = g("fc-ltv") / 100, sell = g("fc-sell") / 100, soft = g("fc-soft") / 100;
    var build = cps * sf, softC = build * soft, basis = price + build + softC;
    var loan = basis * ltv;
    var interest = loan * rate * months / 12; // simple interest on the full balance, a conservative shortcut
    var selling = arv * sell, total = basis + interest + selling, profit = arv - total, cash = basis - loan + interest;
    var m = function (x) { return (x < 0 ? "-$" : "$") + fmt(Math.abs(x)); };
    var rows = [
      ["Construction (" + fmt(sf) + " sf x $" + fmt(cps) + ")", m(build)],
      ["Soft costs (" + (soft * 100).toFixed(0) + "%)", m(softC)],
      ["Loan amount", m(loan)],
      ["Interest over " + fmt(months) + " months", m(interest)],
      ["Selling costs", m(selling)],
      ["All-in cost", m(total)],
      ["Profit before tax", m(profit), "hc-total"],
      ["Margin on resale value", arv ? (profit / arv * 100).toFixed(1) + "%" : "n/a"],
      ["Cash in (down payment plus interest)", m(cash)]
    ];
    $("fc-out").innerHTML = '<table class="hc-table"><caption class="hc-sr">Results from the example or entered numbers</caption>' + rows.map(function (r) {
      return '<tr' + (r[2] ? ' class="' + r[2] + '"' : "") + '><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>";
    }).join("") + "</table>";
  }
  ids.forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", calc); });
  calc();
})();
