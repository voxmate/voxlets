import requests
import html
import random
import hashlib
import json
import time


def hash_f(s):
	return hashlib.sha1(s.encode('utf-8')).hexdigest()


def get_random_questions():
	return requests.get("https://opentdb.com/api.php?amount=50&type=multiple").json()["results"]


def clean_string(str):
	str = html.unescape(str)
	return str


def process_question(item):
	category = item["category"]
	question = clean_string(item["question"])
	answers = [item["correct_answer"]] + item["incorrect_answers"]
	random.shuffle(answers)
	key = answers.index(item["correct_answer"])
	answers = [clean_string(a) for a in answers]
	difficulty = {"easy": 1, "medium": 2, "hard": 3}[item["difficulty"]]

	return category, {
		"qst": question,
		"ans": answers,
		"key": key,
		"dif": difficulty
	}


hit_list = set()
bank = dict()

for _ in range(200):
	questions = get_random_questions()
	for question in questions:
		category, pack = process_question(question)
		bank[category] = category_items = bank.get(category, [])
		key = hash_f(pack["qst"])
		if key not in hit_list:
			category_items.append(pack)
			hit_list.add(key)

	time.sleep(random.random() * 4)

	print(len(hit_list))
	with open("qdata.json", "w") as fp:
		json.dump(bank, fp)
