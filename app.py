"""Vastra — Streamlit entry point. Mode selector + page wiring.

Run: streamlit run app.py
This scaffold renders; the agent logic behind each mode is a TODO for you.
"""

import streamlit as st

from vastra.config import STYLE_PREFERENCES, OCCASIONS
from vastra.quiz import QUIZ_QUESTIONS
from vastra.dictionary import STYLE_DICTIONARY

st.set_page_config(page_title="Vastra", page_icon="👗")
st.title("Vastra 👗")
st.caption("Your AI stylist — emergency fits, trends, and budget-smart shopping.")

style_pref = st.sidebar.selectbox("Style preference", STYLE_PREFERENCES)
mode = st.sidebar.radio(
    "Mode",
    ["🚨 Emergency fit", "✨ Trend stylist", "🛍️ Smart shopping", "📖 Style dictionary"],
)

if mode == "🚨 Emergency fit":
    st.header("Emergency fit — 60 seconds, $0")
    answers = {}
    for q in QUIZ_QUESTIONS:
        answers[q["id"]] = st.radio(q["question"], q["options"], key=q["id"])
    if st.button("Style me"):
        # TODO: prompt = quiz.build_prompt(answers, style_pref)
        #       reply = nemotron.complete(quiz.SYSTEM_PROMPT, prompt)
        #       st.markdown(reply)
        st.info("TODO: wire quiz.build_prompt + nemotron.complete here.")

elif mode == "✨ Trend stylist":
    st.header("Trend stylist")
    occasion = st.selectbox("Occasion", OCCASIONS)
    vibe = st.text_input("Vibe", placeholder="e.g. old money, minimal")
    budget = st.number_input("Budget (USD)", min_value=0.0, value=100.0, step=10.0)
    if st.button("Get outfit"):
        # TODO: prompt = stylist.build_prompt(occasion, vibe, budget, style_pref)
        #       reply = nemotron.complete(stylist.SYSTEM_PROMPT, prompt)
        #       st.markdown(reply)
        st.info("TODO: wire stylist.build_prompt + nemotron.complete here.")

elif mode == "🛍️ Smart shopping":
    st.header("Smart shopping")
    item = st.text_input("What are you looking for?", placeholder="e.g. mom jeans")
    budget = st.number_input("Budget (USD)", min_value=0.0, value=50.0, step=5.0, key="shop_budget")
    source = st.radio("Source", ["Buy new online", "Thrift / local stores"])
    if st.button("Find it"):
        # TODO: products = shopping.search_products(item, budget, style_pref)
        #       for p in shopping.within_budget(products, budget): render card
        st.info("TODO: wire shopping.search_products here.")

else:
    st.header("Style dictionary")
    term = st.selectbox("Look up a term", sorted(STYLE_DICTIONARY))
    st.write(f"**{term}** — {STYLE_DICTIONARY[term]}")
