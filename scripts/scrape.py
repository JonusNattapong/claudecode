import sys
import json
import argparse
from duckduckgo_search import DDGS
from scrapling import Fetcher
import trafilatura

def run_search(query, max_results=5):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            # Format to simple dict list
            formatted = []
            for r in results:
                formatted.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "body": r.get("body", "")
                })
            return {"status": "ok", "results": formatted}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def run_scrape(url):
    try:
        # 1. Initialize Scrapling Fetcher
        f = Fetcher()
        
        # 2. Get the response object stealthily
        res = f.get(url)
        
        # 3. Retrieve HTML content and text
        html = res.html_content
        text = res.text
        
        # 4. Extract title via XPath selector
        title_node = res.xpath('//title/text()').get()
        title = title_node.strip() if title_node else ""
        
        # 5. Extract clean main text/Markdown and metadata using Trafilatura
        clean_text = trafilatura.extract(
            html, 
            output_format='markdown', 
            include_comments=False, 
            include_tables=True
        )
        
        # 6. Extract page metadata
        meta = trafilatura.extract_metadata(html)
        
        result = {
            "status": "ok",
            "title": title or (meta.title if meta else ""),
            "author": meta.author if meta else "",
            "published_at": meta.date if meta else "",
            "markdown": clean_text or text or "",
            "url": url
        }
        return result
    except Exception as e:
        return {"status": "failed", "error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Stealth Web Search and Scraper Helper")
    parser.add_argument("--search", type=str, help="Search query to run on DuckDuckGo")
    parser.add_argument("--url", type=str, help="Web page URL to scrape")
    parser.add_argument("--max-results", type=int, default=5, help="Max search results to return")
    
    args = parser.parse_args()
    
    if args.search:
        result = run_search(args.search, args.max_results)
        print(json.dumps(result))
    elif args.url:
        result = run_scrape(args.url)
        print(json.dumps(result))
    else:
        print(json.dumps({"status": "failed", "error": "Specify either --search or --url"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
