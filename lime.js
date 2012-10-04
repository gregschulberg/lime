/*
Copyright 2012 Fredrik Ehnbom

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

function ColorScheme(name)
{
    var tmLang = loadFile(name);
    this.jsonString = PlistParser.parse(toXML(tmLang));
    var cssDef = "";
    this.cache = {};

    this.createCss = function(name, setting)
    {
        cssDef += name + "\n{\n";

        if (setting.settings.foreground)
        {
            cssDef += "\tcolor:" + setting.settings.foreground + ";\n";
        }
        if (setting.settings.background)
        {
            cssDef += "\tbackground-color:" + setting.settings.background + ";\n";
        }
        if (name == "body")
        {
            cssDef += "\tfont-family:\"Menlo\", sans-serif, monospace;\n";
            cssDef += "\tfont-size:12px;\n";
            cssDef += "\twhite-space:pre;\n";
        }

        cssDef += "}\n";
    }

    for (var i in this.jsonString.settings)
    {
        var setting = this.jsonString.settings[i];
        if (setting.settings)
        {
            var name = "body";
            if (setting.scope)
            {
                setting.scope = setting.scope.split(",");
                for (var j in setting.scope)
                {
                    setting.scope[j] = setting.scope[j].trim();
                    name = "." + setting.scope[j].replace(/\./g, "_");
                    this.createCss(name, setting);
                }
            }
            else
            {
                this.createCss(name, setting);
                if (setting.settings.selection)
                {
                    var def = "::selection\n{\n";
                    if (setting.settings.background)
                    {
                        var rgb1 = hexToRgb(setting.settings.selection);
                        var rgb2 = hexToRgb(setting.settings.background);
                        def += "\tbackground-color:" + rgbToHex(rgb1.r+rgb2.r, rgb1.g+rgb2.g, rgb1.b+rgb2.b) + ";\n";
                    }
                    else
                    {
                        def += "\tbackground-color:" + setting.settings.selection + ";\n";
                    }
                    def += "}\n";
                    cssDef += name + def;
                    cssDef += ".default" + def;
                }
                cssDef += ".main\n{                    \n"  +
                          "    padding-right:200px;    \n"  +
                          "}                           \n";
                cssDef += ".lineNumbers\n{             \n"  +
                          "    vertical-align:text-top;\n"  +
                          "    text-align:right;       \n"  +
                          "    color:#777777;          \n"  +
                          "    padding-right: 15px;    \n"  +
                          "}                           \n";
                cssDef += ".minimap\n{                 \n"  +
                          "    font-size:2px;          \n"  +
                          "    vertical-align:text-top;\n"  +
                          "    padding-left:15px;      \n"  +
                          "    position:fixed;         \n"  +
                          "    right:0px;              \n"  +
                          "    z-index:10;             \n"  +
                          "    background-color:" + setting.settings.background + ";             \n"  +
                          "}                           \n";
                cssDef += ".minimap_visible_area\n{    \n"  +
                          "    position:fixed;         \n"  +
                          "    height:200px;           \n"  +
                          "    width:200px;           \n"  +
                          "    right:0px;              \n"  +
                          "    top:0px;                \n"  +
                          "    z-index:11;             \n"  +
                          "    vertical-align:text-top;\n"  +
                          "    opacity:0.1;            \n"  +
                          "    background-color:#ffffff\n"  +
                          "}                           \n";
            }
        }
    }

    var sheet = document.createElement('style')
    sheet.innerHTML = cssDef;
    document.body.appendChild(sheet);


    this.getCssClassesForScopes = function(scopes)
    {
        if (this.cache[scopes])
        {
            return this.cache[scopes];
        }
        var key = scopes;
        while (scopes.length)
        {
            for (var i in this.jsonString.settings)
            {
                var setting = this.jsonString.settings[i];
                if (setting.scope)
                {
                    for (var j in setting.scope)
                    {
                        if (scopes.endsWith(setting.scope[j]))
                        {
                            var value = setting.scope[j].replace(/\./g, "_");
                            this.cache[key] = value;
                            return value;
                        }
                    }
                }
            }
            var idx = scopes.lastIndexOf(".");
            var idx2 = scopes.lastIndexOf(" ");
            if (idx == idx2)
                break;
            scopes = scopes.slice(0, Math.max(idx, idx2));
        }
        this.cache[key] = "default";
        return "default";
    }
    return this;
}

function SyntaxPattern(pattern, syntax)
{
    if (pattern.match)
    {
        this.match = new Regex(pattern.match);
    }
    if (pattern.begin)
    {
        this.begin = new Regex(pattern.begin);
    }
    if (pattern.end)
    {
        this.end = new Regex(pattern.end);
    }
    this.captures = pattern.captures;
    this.beginCaptures = pattern.beginCaptures;
    this.endCaptures = pattern.endCaptures;
    if (pattern.patterns)
    {
        this.patterns = new Array();
        for (var i in pattern.patterns)
        {
            var pat = pattern.patterns[i];
            if (pat.include)
            {
                pat = syntax.jsonData.repository[pat.include.slice(1)];
                if (pat)
                {
                    for (var j in pat.patterns)
                    {
                        this.patterns.push(pat.patterns[j]);
                    }
                }
            }
            else
            {
                this.patterns.push(new SyntaxPattern(pattern.patterns[i], syntax));
            }
        }
    }
    this.name = pattern.name;
    return this;
}

function Syntax(name)
{
    var tmLang = loadFile(name);
    var jsonString = PlistParser.parse(toXML(tmLang));
    this.jsonData = jsonString;
    for (var i in jsonString.repository)
    {
        var repo = jsonString.repository[i];
        for (var j in repo.patterns)
        {
            repo.patterns[j] = new SyntaxPattern(repo.patterns[j], this);
        }
    }

    var patterns = jsonString.patterns;
    for (var i in patterns)
    {
        var pattern = patterns[i];
        patterns[i] = new SyntaxPattern(pattern, this);
    }

    this.firstMatch = function(data, patterns, cache, remove)
    {
        // Find the pattern that is the earliest match
        var match = null;
        var startIdx = -1;
        var pattern = null;
        for (var i = 0; i < patterns.length; )
        {
            var innerPattern = patterns[i];
            var innermatch = null;
            if (innerPattern.match)
            {
                innermatch = cache[i] ? cache[i] : innerPattern.match.exec(data);
            }
            else if (innerPattern.begin)
            {
                innermatch = cache[i] ? cache[i] : innerPattern.begin.exec(data);
            }
            cache[i] = innermatch;
            if (innermatch)
            {
                var idx = innermatch.index;
                if (startIdx < 0 || startIdx > idx)
                {
                    startIdx = idx;
                    match = innermatch;
                    pattern = innerPattern;
                }
            }
            if (remove && innermatch == null)
            {
                // No match was found and we've indicated that the pattern can be removed
                // if that is the case (ie if it wasn't found, it's never going to be found,
                // so no point in looking for it again after this point).
                patterns.splice(i, 1);
                cache.splice(i, 1);
            }
            else
            {
                i++;
            }
        }
        return {pattern:pattern, match:match};
    }
    this.flushCache = function(cache, end)
    {
        for (var i in cache)
        {
            // disqualify patterns that are inside of the selected pattern
            if (cache[i])
            {
                if (!cache[i][0])
                {
                    cache[i] = null;
                    continue;
                }
                var end2 = cache[i].index+cache[i][0].length;
                if (cache[i].index <= end)
                {
                    // starts within or before the selected pattern
                    cache[i] = null;
                }
                else if (end2 <= end)
                {
                    // ends within or before the selected pattern
                    cache[i] = null;
                }
                else if (cache[i].lookback && end2-cache[i].lookback.length < end)
                {
                    cache[i] = null;
                }

                if (cache[i])
                {
                    cache[i].index -= end;
                }
            }
        }
    }

    this.innerApplyPattern = function(data, scope, match, captures)
    {
        var ret = "";
        if (captures)
        {
            var lastIdx = 0;
            if (captures[0])
            {
                ret += "<!--" + scope + " " + captures[0].name + "--><span class=\"" + colorScheme.getCssClassesForScopes(scope + " " + captures[0].name) + "\">";
            }

            for (var i = 1; i < match.length; i++)
            {
                if (!match[i])
                {
                    continue;
                }
                if (!match[0].slice(lastIdx).startsWith(match[i]))
                {
                    ret += match[0].slice(lastIdx, match[0].indexOf(match[i], lastIdx));
                }

                var capture = captures[i];
                var span = htmlify(match[i]);
                if (capture)
                {
                    span = "<!--" + scope + " " + capture.name + "--><span class=\"" + colorScheme.getCssClassesForScopes(scope + " " + capture.name) + "\">" + span + "</span>";
                }

                ret += span;
                lastIdx = match[0].indexOf(match[i], lastIdx) + match[i].length;
            }
            if (lastIdx != match[0].length)
            {
                ret += match[0].slice(lastIdx);
            }
            if (captures[0])
            {
                ret += "</span>";
            }
        }
        else
        {
            ret += htmlify(match[0]);
        }
        fullline = match[0];
        start = match.index;

        var idx = start + fullline.length;
        data = data.slice(idx);
        return {"ret": ret, "data": data};
    }

    this.applyPattern = function(data, scope, pattern, colorScheme)
    {
        var ret = "";
        var match = pattern.match;
        var pattern = pattern.pattern;
        var start = 0;


        scope += " " + pattern.name;

        ret += htmlify(data.slice(0, match.index));
        ret += "<!--" + scope + "--><span class=\"" + colorScheme.getCssClassesForScopes(scope) + "\">";
        var fullline = "";


        if (pattern.match)
        {
            var appl = this.innerApplyPattern(data, scope, match, pattern.captures);
            data = appl.data;
            ret += appl.ret;
        }
        else
        {
            match = pattern.begin.exec(data);
            var appl = this.innerApplyPattern(data, scope, match, pattern.beginCaptures)
            data = appl.data;
            ret += appl.ret;

            start = 0;

            var idx = start;
            var end = data.length;
            if (pattern.end)
            {
                var cache = new Array();
                while (data.length)
                {
                    var slice = data.slice(idx);
                    var match2 = pattern.end.exec(slice);
                    if (match2)
                    {
                        end = match2.index + idx + match2[0].length;
                    }
                    else
                    {
                        if (cache.length == 0)
                        {
                            // oops.. no end found, set it to the next line
                            end = data.indexOf("\n");
                        }
                        else
                        {
                            end = idx;
                            break;
                        }
                    }

                    if (pattern.patterns)
                    {

                        var pattern2 = this.firstMatch(slice, pattern.patterns, cache);

                        if (pattern2 && pattern2.match && ((!match2 && pattern2.match.index < end) || (match2 && pattern2.match.index < match2.index)))
                        {
                            var applied = this.applyPattern(slice, scope, pattern2, colorScheme);
                            ret += applied.ret;
                            start = end = idx = 0;
                            var flush = data.length - applied.data.length;
                            this.flushCache(cache, flush);
                            data = applied.data;
                            continue;
                        }
                    }
                    if (match2)
                    {
                        ret += htmlify(data.slice(0, match2.index));
                        var appl = this.innerApplyPattern(slice, scope, match2, pattern.endCaptures)
                        data = appl.data;
                        ret += appl.ret;
                        start = end = idx = 0;
                    }

                    break;
                }
            }
            if (start != end)
            {
                var span = data.slice(start, end);
                ret += htmlify(span);
                fullline = span;
            }
        }
        ret += "</span>"
        var idx = start + fullline.length;
        if (idx != 0)
        {
            data = data.slice(idx);
        }
        return {"ret": ret, "data": data};
    }
    this.transform = function(data, colorScheme)
    {
        var ret = "";
        ret += "<span class=\"" + colorScheme.getCssClassesForScopes(this.jsonData.scopeName) + "\">";

        var max = 10000;
        var cache = new Array();
        while (data.length > 0 && --max > 0)
        {
            var scope = this.jsonData.scopeName;
            var pattern = this.firstMatch(data, this.jsonData.patterns, cache, true);

            if (!pattern.pattern)
            {
                // No more matches found
                break;
            }
            else
            {
                var applied = this.applyPattern(data, scope, pattern, colorScheme);
                ret += applied.ret;
                var flushLen = data.length - applied.data.length;
                this.flushCache(cache, flushLen);
                data = applied.data;
            }
        }
        ret += "</span>";
        return ret;
    }
    return this;
}


function Theme(name)
{
    var data = loadFile(name);
    data = data.replace(/\/\/[^\n]*\n/g, "")
    var json = JSON.parse(data);

    function tocss(stcolor,name)
    {
        if (stcolor)
        {
            return "\t" + name + ":" + rgbToHex(stcolor[0], stcolor[1], stcolor[2]) + "\n";
        }
        return "";
    }

    this.createCSS = function(item)
    {
        var selected="";
        var normal="";
        normal += "." + item.class;
        if (item.attributes)
        {
            normal += "_" + item.attributes.join("_");
        }
        normal += "\n{\n";
        if (item.class === "overlay_control")
        {
            normal += "\tmargin-left:auto;\n";
            normal += "\tmargin-right:auto;\n";
            normal += "\twidth:33%;\n";
        }
        if (item.class === "quick_panel")
        {
            normal += "\toverflow:hidden;\n";
            normal += "\theight:200px;\n";
        }

        if (item["layer0.texture"])
        {
            var offsets = "1";
            if (item["layer0.inner_margin"])
            {
                var o = item["layer0.inner_margin"];
                o = [o[1], o[0], o[3], o[2]];
                offsets = o.join(" ");
                normal += "\tborder-width: " + o.join("px ") + "px;\n";
                if (item["content_margin"])
                {
                    var o2 = item["content_margin"];
                    o2 = [o2[1], o2[0], o2[3], o2[2]];
                    o2 = [o[0]-o2[0], o[1]-o2[1], o[2]-o2[2], o[3]-o2[3]];
                    normal += "\tpadding: " + o2.join("px ") + "px;\n";
                }
            }
            normal += "\tborder-image:url(\"3rdparty/" + item["layer0.texture"] + "\") " + offsets + " fill stretch;\n";
        }
        if (item.class.indexOf("quick_panel_row") != -1)
        {
            normal += "\twidth:100%;\n";
            normal += "\toverflow:hidden;\n";
        }
        normal += tocss(item.fg, "color");
        normal += tocss(item.bg, "background-color");
        normal += "}\n";
        return normal;
    }
    var css = "";
    for (var i in json)
    {
        var item = json[i];
        if (item.class.indexOf("quick_panel") != -1 || item.class.indexOf("overlay_control") != -1)
        {
            css += this.createCSS(item);
        }
    }
    var sheet = document.createElement('style');
    sheet.innerHTML = css;
    document.body.appendChild(sheet);

    return this;
}
/*
var quick_panel = document.createElement('span');

var qp = "<div class=\"overlay_control quick_panel\">";
for (var i = 0; i < 20; i++)
{
    var row = "quick_panel_row";
    if (i == 2)
        row += " quick_panel_row_selected";

    qp += "<div class=\"" + row + " quick_panel_label\">Hello</div>";
}
qp += "</div>";
quick_panel.innerHTML = qp;
document.body.appendChild(quick_panel);
*/
function main_onclick(e)
{
    if (!e) var e = window.event;

    console.log(e);
}

var targetScroll = null;
var scroller = null;
var lastTime = -1;
function doScroll()
{
    var currTime = new Date().getTime();
    if (lastTime == -1)
    {
        lastTime = currTime;
    }
    var diff = currTime-lastTime;
    lastTime = currTime;
    var current = window.pageYOffset;
    if (Math.abs(targetScroll-current) > 5)
    {
        var diff2 = targetScroll-current;
        diff = diff2*0.0175*diff;
        if (Math.abs(diff) > Math.abs(diff2))
        {
            diff = diff2;
        }
        window.scrollBy(0, diff);
    }
    else
    {
        lastTime = -1;
        window.scrollTo(window.pageXOffset, targetScroll);
        clearInterval(scroller);
    }
}

function minimap_onclick(e)
{
    if (!e) var e = window.event;
    if (!e.y) e.y = e.clientY;
    var minimap = document.getElementById('minimap');

    var tp = window.pageYOffset/(document.body.offsetHeight-window.innerHeight);
    var p = (e.y/window.innerHeight);

    var diff = minimap.offsetHeight-window.innerHeight
    var top = tp*(diff);
    var div = minimap.offsetHeight/(diff);
    var target = (top + p*window.innerHeight)/minimap.offsetHeight;

    var current = window.pageYOffset;
    targetScroll = target*(document.body.offsetHeight-window.innerHeight);

    scroller = setInterval("doScroll()", 30);
}

var drag = false;
function minimap_area_ondown(e)
{
    document.body.onselectstart= function() { return false; };
    document.body.onmousedown= function() { return false; };
    drag = true;
}

document.body.onmouseup = function() { drag = false; };

window.onscroll = function()
{
    var scroll = window.pageYOffset/(document.body.offsetHeight-window.innerHeight);
    var minimap = document.getElementById('minimap');
    minimap.style.top = -(scroll*(minimap.offsetHeight-window.innerHeight)) + "px";

    var minimap_visible_area = document.getElementById('minimap_visible_area');
    var height = minimap.offsetHeight*(window.innerHeight/document.body.offsetHeight);
    minimap_visible_area.style.height = height + "px";
    minimap_visible_area.style.top = (scroll*(window.innerHeight-height)) + "px";
    minimap_visible_area.style.width = minimap.offsetWidth + "px";
}

document.body.onmousemove =function(e)
{
    if (drag)
    {
        if (!e) var e = window.event;
        if (!e.y) e.y = e.clientY;

        window.scrollTo(window.pageXOffset, (e.y/window.innerHeight)*(document.body.offsetHeight-window.innerHeight));
    }
}
window.onkeydown = function(e)
{
    if (e.metaKey && e.keyCode == 'P'.charCodeAt(0))
    {
        e.preventDefault();
        console.log("Hello");
    }
}

var startTime = new Date().getTime();
var colorScheme = new ColorScheme("3rdparty/monokai.tmbundle/Themes/Monokai.tmTheme")
var syntax = new Syntax("3rdparty/javascript.tmbundle/Syntaxes/JavaScript.plist");
var theme = new Theme("3rdparty/Theme - Soda/Soda Dark.sublime-theme");

var data = loadFile("lime.js");
console.log("theme, color scheme, syntax loading: " + ((new Date().getTime()-startTime)/1000.0));
startTime = new Date().getTime();
var tdata = syntax.transform(data, colorScheme);
console.log("transform1: " + ((new Date().getTime()-startTime)/1000.0));
var lineNumbers = "";
var regex = /\n/g;
var count = 0;
while (regex.exec(tdata))
{
    if (count++ > 1000)
        break;
    lineNumbers += count + "<br>";
}

var main = document.createElement('span');
var html = "<table><tr><td class=\"lineNumbers\">" + lineNumbers + "</td>";
html += "<td id=\"main\" class=\"main\" onclick=\"main_onclick();\">" + tdata + "</td>";
html += "<td id=\"minimap\" class=\"minimap\" onclick=\"minimap_onclick(event);\">" + tdata + "</td></tr></table>";
html += "<div id=\"minimap_visible_area\" class=\"minimap_visible_area\" onmousedown=\"minimap_area_ondown()\"></div>";
main.innerHTML = html;
document.body.appendChild(main);
window.onscroll();
